import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const BASE_URL = 'http://localhost:8080/ws';

class WebSocketService {
  constructor() {
    this.client = null;
    this.subscriptions = {};
    this.connected = false;
    this.reconnectDelay = 5000;
  }

  connect(token, onConnected, onDisconnected) {
    this.client = new Client({
      webSocketFactory: () => new SockJS(BASE_URL),
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: this.reconnectDelay,

      onConnect: () => {
        this.connected = true;
        console.log('WebSocket connected');
        onConnected?.();
      },

      onDisconnect: () => {
        this.connected = false;
        console.log('WebSocket disconnected');
        onDisconnected?.();
      },

      onStompError: (frame) => {
        console.error('STOMP error:', frame);
      },
    });

    this.client.activate();
  }

  subscribe(topic, callback) {
    if (!this.client || !this.connected) return;
    if (this.subscriptions[topic]) {
      this.subscriptions[topic].unsubscribe();
    }
    this.subscriptions[topic] = this.client.subscribe(topic, (msg) => {
      try {
        callback(JSON.parse(msg.body));
      } catch (e) {
        callback(msg.body);
      }
    });
  }

  subscribeToGlobalPrice(callback) {
    this.subscribe('/topic/global-price', callback);
  }

  subscribeToIranPrice(callback) {
    this.subscribe('/topic/iran-price', callback);
  }

  subscribeToSignal(market, callback) {
    this.subscribe(`/topic/signal/${market.toLowerCase()}`, callback);
  }

  subscribeToHealth(callback) {
    this.subscribe('/topic/health', callback);
  }

  disconnect() {
    Object.values(this.subscriptions).forEach((sub) => sub?.unsubscribe());
    this.subscriptions = {};
    this.client?.deactivate();
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }
}

export default new WebSocketService();
