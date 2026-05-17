import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

class WsService {
  constructor() {
    this.client    = null;
    this.subs      = {};   // one STOMP subscription per topic
    this.cbs       = {};   // Set of callbacks per topic (multiple allowed)
    this.connected = false;
  }

  connect(onConnected, onDisconnected) {
    this.client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        this.connected = true;
        // Re-subscribe all registered topics
        Object.keys(this.cbs).forEach(topic => {
          if (this.cbs[topic]?.size > 0) this._doSubscribe(topic);
        });
        onConnected?.();
      },
      onDisconnect: () => {
        this.connected = false;
        this.subs = {};
        onDisconnected?.();
      },
    });
    this.client.activate();
  }

  _doSubscribe(topic) {
    this.subs[topic]?.unsubscribe();
    this.subs[topic] = this.client.subscribe(topic, msg => {
      let data;
      try { data = JSON.parse(msg.body); } catch { data = msg.body; }
      this.cbs[topic]?.forEach(cb => { try { cb(data); } catch {} });
    });
  }

  // Subscribe and return an unsubscribe function for cleanup
  subscribe(topic, cb) {
    if (!this.cbs[topic]) this.cbs[topic] = new Set();
    this.cbs[topic].add(cb);

    if (this.connected && !this.subs[topic]) {
      this._doSubscribe(topic);
    }

    return () => {
      this.cbs[topic]?.delete(cb);
    };
  }

  onGlobalPrice(cb) { return this.subscribe('/topic/global-price', cb); }
  onIranPrice(cb)   { return this.subscribe('/topic/iran-price', cb); }
  onSignal(market, cb) { return this.subscribe(`/topic/signal/${market.toLowerCase()}`, cb); }
  onHealth(cb)      { return this.subscribe('/topic/health', cb); }

  disconnect() {
    Object.values(this.subs).forEach(s => s?.unsubscribe());
    this.client?.deactivate();
    this.connected = false;
    this.subs = {};
    this.cbs  = {};
  }
}

export default new WsService();
