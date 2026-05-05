package mqtt

import (
	"fmt"
	"mqtt/config"
	"mqtt/utils"
	"time"

	mq "github.com/eclipse/paho.mqtt.golang"
)

// Client is the local broker connection (always present).
// CloudClient is the cloud broker connection (nil if CLOUD_MQTT_HOST is unset).
var Client mq.Client
var CloudClient mq.Client

var subscribedTopics = make(map[string]mq.MessageHandler)

func InitializeMQTT() {
	// Local broker must be reachable at startup — fatal if not.
	Client = newClient(
		"local",
		config.LocalMQTTHost, config.LocalMQTTPort,
		config.LocalMQTTUser, config.LocalMQTTPassword,
		false,
	)
	if token := Client.Connect(); token.Wait() && token.Error() != nil {
		utils.SugarLogger.Fatalln("[MQ][local] Failed to connect:", token.Error())
	}

	// Cloud broker is best-effort — retry forever in background so we don't
	// block startup on cloud reachability. Local keeps working regardless.
	if config.CloudMQTTHost != "" {
		CloudClient = newClient(
			"cloud",
			config.CloudMQTTHost, config.CloudMQTTPort,
			config.CloudMQTTUser, config.CloudMQTTPassword,
			true,
		)
		CloudClient.Connect()
	} else {
		utils.SugarLogger.Infoln("[MQ][cloud] CLOUD_MQTT_HOST unset, dual-publish disabled")
	}
}

func newClient(label, host, port, user, password string, connectRetry bool) mq.Client {
	opts := mq.NewClientOptions()
	opts.AddBroker(fmt.Sprintf("tcp://%s:%s", host, port))
	opts.SetUsername(user)
	opts.SetPassword(password)
	opts.SetAutoReconnect(true)
	opts.SetClientID(fmt.Sprintf("gr26-tcm-%s-%06d", label, time.Now().UnixNano()%1000000))
	opts.SetOnConnectHandler(onConnectFn(label))
	opts.SetConnectionLostHandler(onConnectionLostFn(label))
	opts.SetReconnectingHandler(onReconnectFn(label))
	opts.SetMaxReconnectInterval(30 * time.Second)
	opts.SetOrderMatters(false)
	// ConnectRetry retries the initial connection (paho's AutoReconnect only
	// kicks in after a successful first connect, so we need this explicitly
	// for callers that may start before their broker is available).
	if connectRetry {
		opts.SetConnectRetry(true)
		opts.SetConnectRetryInterval(5 * time.Second)
	}
	return mq.NewClient(opts)
}

// Publish sends payload to both local and cloud brokers (best-effort).
// Each publish runs in its own goroutine so a slow/disconnected broker
// can't block the caller. Use this for all telemetry from the relay.
func Publish(topic string, qos byte, retained bool, payload []byte) {
	publishOne(Client, "local", topic, qos, retained, payload)
	if CloudClient != nil {
		publishOne(CloudClient, "cloud", topic, qos, retained, payload)
	}
}

func publishOne(client mq.Client, label, topic string, qos byte, retained bool, payload []byte) {
	token := client.Publish(topic, qos, retained, payload)
	go func() {
		if !token.WaitTimeout(2 * time.Second) {
			utils.SugarLogger.Warnf("[MQ][%s] Publish to %s timed out", label, topic)
			return
		}
		if token.Error() != nil {
			utils.SugarLogger.Warnf("[MQ][%s] Publish to %s failed: %v", label, topic, token.Error())
		}
	}()
}

// Subscribe subscribes on the local client only. Subscriptions on the
// cloud broker are not supported — this service only publishes to cloud.
func Subscribe(topic string, handler mq.MessageHandler) {
	if token := Client.Subscribe(topic, 0, handler); token.Wait() && token.Error() != nil {
		utils.SugarLogger.Errorln("[MQ][local] Failed to subscribe to topic:", topic, token.Error())
		return
	}
	subscribedTopics[topic] = handler
	utils.SugarLogger.Infoln("[MQ][local] Subscribed to topic:", topic)
}

func onConnectFn(label string) mq.OnConnectHandler {
	return func(client mq.Client) {
		utils.SugarLogger.Infof("[MQ][%s] Connected to broker", label)
		// Only the local client tracks subscriptions.
		if label != "local" {
			return
		}
		for topic, handler := range subscribedTopics {
			if token := client.Subscribe(topic, 0, handler); token.Wait() && token.Error() != nil {
				utils.SugarLogger.Errorln("[MQ][local] Failed to resubscribe to topic:", topic, token.Error())
				continue
			}
			utils.SugarLogger.Infoln("[MQ][local] Resubscribed to topic:", topic)
		}
	}
}

func onConnectionLostFn(label string) mq.ConnectionLostHandler {
	return func(client mq.Client, err error) {
		utils.SugarLogger.Errorf("[MQ][%s] Connection lost: %v", label, err)
	}
}

func onReconnectFn(label string) mq.ReconnectHandler {
	return func(client mq.Client, opts *mq.ClientOptions) {
		utils.SugarLogger.Infof("[MQ][%s] Reconnecting...", label)
	}
}
