/* Motor cliente sin interfaz para una experiencia privada futura. */
(() => {
  'use strict';

  const DB_NAME = 'love-house-story';
  const STORE_NAME = 'pending-events';
  let client = null;
  let snapshot = { available: false };
  let flushing = null;

  function eventKey() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `story-${Date.now()}-${crypto.getRandomValues(new Uint32Array(2)).join('-')}`;
  }

  function openQueue() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'eventKey' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function queueOperation(mode, value) {
    const database = await openQueue();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = mode === 'put' ? store.put(value) : store.delete(value);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
      request.onerror = () => reject(request.error);
    });
  }

  async function pendingOperations() {
    const database = await openQueue();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result.sort((a, b) => a.createdAt - b.createdAt));
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
    });
  }

  function publish(next) {
    snapshot = next || { available: false };
    window.dispatchEvent(new CustomEvent('housestorychange', { detail: snapshot }));
    return snapshot;
  }

  function requireClient() {
    client ||= window._loveClient;
    if (!client) throw new Error('La sesión de la casa todavía no está lista.');
    return client;
  }

  async function load() {
    const { data, error } = await requireClient().rpc('get_house_story_progress');
    if (error) throw error;
    return publish(data);
  }

  async function send(operation) {
    const rpcName = operation.rpc || 'advance_house_story';
    const rpcParams = operation.rpc ? operation.params : {
      p_event_key: operation.eventKey,
      p_action: operation.action,
      p_payload: operation.payload
    };
    const { data, error } = await requireClient().rpc(rpcName, rpcParams);
    if (error) throw error;
    await queueOperation('delete', operation.eventKey);
    if (operation.publish === false) return data;
    return publish(data);
  }

  async function advance(action, payload = {}, options = {}) {
    const operation = {
      eventKey: options.eventKey || eventKey(),
      action,
      payload,
      createdAt: Date.now()
    };
    await queueOperation('put', operation);
    if (!navigator.onLine) return { ...snapshot, pending: true, eventKey: operation.eventKey };
    return send(operation);
  }

  async function advanceRpc(rpc, params = {}, options = {}) {
    const key = options.eventKey || eventKey();
    const operation = { eventKey:key, rpc, params:{ ...params, p_event_key:key }, publish:options.publish !== false, createdAt:Date.now() };
    await queueOperation('put', operation);
    if (!navigator.onLine) return { ...snapshot, pending:true, eventKey:key };
    return send(operation);
  }

  async function flush() {
    if (flushing) return flushing;
    flushing = (async () => {
      if (!navigator.onLine) return snapshot;
      for (const operation of await pendingOperations()) await send(operation);
      return load();
    })().finally(() => { flushing = null; });
    return flushing;
  }

  async function reset(identity = 'princesa') {
    const { data, error } = await requireClient().rpc('reset_house_story_progress', { p_identity: identity });
    if (error) throw error;
    publish({ available: false });
    return data;
  }

  async function storyRpc(name, params = {}) {
    const { data, error } = await requireClient().rpc(name, params);
    if (error) throw error;
    if (data?.available !== undefined || data?.chapter !== undefined) publish(data);
    return data;
  }

  window.HouseStoryEngine = Object.freeze({
    load,
    flush,
    reset,
    start: options => advance('start', {}, options),
    completeStep: (step, options) => advance('complete_step', { step }, options),
    useHint: (level, options) => advance('use_hint', { level }, options),
    complete: options => advance('complete', {}, options),
    loadCorner: () => storyRpc('get_house_story_corner'),
    chooseCorner: (corner, options = {}) => advanceRpc('choose_house_story_corner', { p_corner:corner }, options),
    placeCornerItem: (item, slot, options = {}) => advanceRpc('place_house_story_item_at', { p_item:item, p_slot:slot }, options),
    finishCorner: (options = {}) => advanceRpc('finish_house_story_corner', {}, options),
    loadDoor: () => storyRpc('get_house_story_door'),
    openDoor: (options = {}) => advanceRpc('open_house_story_door', {}, options),
    loadCompanion: () => storyRpc('get_house_story_companion'),
    revealCompanion: (options = {}) => advanceRpc('reveal_house_story_companion', {}, options),
    updateCompanion: (action, payload = {}, options = {}) => advanceRpc('update_house_story_companion', { p_action:action, p_payload:payload }, { ...options, publish:false }),
    snapshot: () => snapshot
  });

  window.addEventListener('online', () => flush().catch(() => {}));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window._loveClient) flush().catch(() => load().catch(() => {}));
  });
})();
