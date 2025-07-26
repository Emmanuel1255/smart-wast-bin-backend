// src/services/mqttService.ts
import mqtt from 'mqtt';
import { env } from '../config/env';
import { BinService } from '../services/binService';
import { RealtimeBinService } from '../services/realtimeBinService';
import { BinSensorDataRequest } from '@/types/bin';

export class MQTTService {
  private client: mqtt.MqttClient;
  private binService: BinService;
  private realtimeService: RealtimeBinService;

  constructor(realtimeService: RealtimeBinService) {
    this.binService = new BinService();
    this.realtimeService = realtimeService;

    // Initialize MQTT client
    this.client = mqtt.connect(env.MQTT_BROKER_URL, {
      clientId: 'smart-waste-backend',
      username: env.MQTT_USERNAME,
      password: env.MQTT_PASSWORD,
      clean: true,
      reconnectPeriod: 1000,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup MQTT event handlers
   */
  private setupEventHandlers() {
    this.client.on('connect', () => {
      console.log('🔗 Connected to MQTT broker');
      this.subscribeToTopics();
    });

    this.client.on('message', async (topic, message) => {
      try {
        await this.handleMessage(topic, message.toString());
      } catch (error) {
        console.error('Error handling MQTT message:', error);
      }
    });

    this.client.on('error', (error) => {
      console.error('MQTT Error:', error);
    });

    this.client.on('offline', () => {
      console.log('📴 MQTT client offline');
    });

    this.client.on('reconnect', () => {
      console.log('🔄 MQTT client reconnecting...');
    });
  }

  /**
   * Subscribe to MQTT topics
   */
  private subscribeToTopics() {
    const topics = [
      'smartwaste/bins/+/data',        // Bin sensor data
      'smartwaste/bins/+/status',      // Bin status updates
      'smartwaste/bins/+/alert',       // Bin alerts
      'smartwaste/system/health',      // System health
    ];

    topics.forEach(topic => {
      this.client.subscribe(topic, (error) => {
        if (error) {
          console.error(`Failed to subscribe to ${topic}:`, error);
        } else {
          console.log(`📥 Subscribed to ${topic}`);
        }
      });
    });
  }

  /**
   * Handle incoming MQTT messages
   */
  private async handleMessage(topic: string, message: string) {
    try {
      const data = JSON.parse(message);
      
      if (topic.includes('/data')) {
        await this.handleSensorData(topic, data);
      } else if (topic.includes('/status')) {
        await this.handleStatusUpdate(topic, data);
      } else if (topic.includes('/alert')) {
        await this.handleAlert(topic, data);
      } else if (topic.includes('/health')) {
        await this.handleHealthUpdate(data);
      }
    } catch (error) {
      console.error('Error parsing MQTT message:', error);
    }
  }

  /**
   * Handle sensor data from bins
   */
  private async handleSensorData(topic: string, data: any) {
    const binCode = this.extractBinCodeFromTopic(topic);
    
    const sensorData: BinSensorDataRequest = {
      fillLevel: data.fillLevel,
      weight: data.weight,
      temperature: data.temperature,
      humidity: data.humidity,
      batteryLevel: data.batteryLevel,
      signalStrength: data.signalStrength
    };

    // Update database
    await this.binService.updateSensorData(binCode, sensorData);

    // Broadcast real-time update
    await this.realtimeService.handleBinLevelUpdate({ binCode, sensorData });

    console.log(`📊 Sensor data updated for bin ${binCode}:`, sensorData);
  }

  /**
   * Handle status updates from bins
   */
  private async handleStatusUpdate(topic: string, data: any) {
    const binCode = this.extractBinCodeFromTopic(topic);
    
    console.log(`📡 Status update for bin ${binCode}:`, data);
    
    // You can add custom status update logic here
  }

  /**
   * Handle alerts from bins
   */
  private async handleAlert(topic: string, data: any) {
    const binCode = this.extractBinCodeFromTopic(topic);
    
    console.log(`🚨 Alert from bin ${binCode}:`, data);
    
    // Broadcast emergency alert
    this.realtimeService.broadcastEmergencyAlert(data.message, data.binId);
  }

  /**
   * Handle system health updates
   */
  private async handleHealthUpdate(data: any) {
    console.log('💓 System health update:', data);
    
    // You can add system health monitoring logic here
  }

  /**
   * Extract bin code from MQTT topic
   */
  private extractBinCodeFromTopic(topic: string): string {
    const parts = topic.split('/');
    return parts[2]; // smartwaste/bins/BINCODE/data
  }

  /**
   * Publish message to MQTT topic
   */
  public publish(topic: string, message: any) {
    this.client.publish(topic, JSON.stringify(message), { qos: 1 });
  }

  /**
   * Send command to specific bin
   */
  public sendBinCommand(binCode: string, command: any) {
    const topic = `smartwaste/bins/${binCode}/command`;
    this.publish(topic, command);
  }

  /**
   * Disconnect MQTT client
   */
  public disconnect() {
    this.client.end();
  }
}