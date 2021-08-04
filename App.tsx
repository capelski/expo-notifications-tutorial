import { Subscription } from '@unimodules/core';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import JSONTree from 'react-native-json-tree';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false
    })
});

const registerForPushNotificationsAsync = () => {
    if (!Constants.isDevice) {
        return Promise.reject('Must use physical device for Push Notifications');
    }

    try {
        return Notifications.getPermissionsAsync()
            .then((statusResult) => {
                return statusResult.status !== 'granted'
                    ? Notifications.requestPermissionsAsync()
                    : statusResult;
            })
            .then((statusResult) => {
                if (statusResult.status !== 'granted') {
                    throw 'Failed to get push token for push notification!';
                }
                return Notifications.getExpoPushTokenAsync();
            })
            .then((tokenData) => {
                if (Platform.OS === 'android') {
                    Notifications.setNotificationChannelAsync('default', {
                        name: 'default',
                        importance: Notifications.AndroidImportance.MAX,
                        vibrationPattern: [0, 250, 250, 250],
                        lightColor: '#FF231F7C'
                    });
                }

                return tokenData.data;
            });
    } catch (error) {
        return Promise.reject("Couldn't check notifications permissions");
    }
};

const schedulePushNotification = () =>
    Notifications.scheduleNotificationAsync({
        content: {
            title: "You've got mail! 📬",
            body: 'Here is the notification body',
            data: { data: 'goes here' }
        },
        trigger: { seconds: 2 }
    });

let notificationsHandler: undefined | ((notification: Notifications.Notification) => void);
const pendingNotifications: Notifications.Notification[] = [];

const notificationReceivedListener = Notifications.addNotificationReceivedListener(
    (notification) => {
        if (notificationsHandler !== undefined) {
            notificationsHandler(notification);
        } else {
            pendingNotifications.push(notification);
        }
    }
);

const notificationResponseReceivedListener = Notifications.addNotificationResponseReceivedListener(
    (response) => {
        if (notificationsHandler !== undefined) {
            notificationsHandler(response.notification);
        } else {
            pendingNotifications.push(response.notification);
        }
    }
);

export default function App() {
    const [errorMessage, setErrorMessage] = useState<string>();
    const [expoPushToken, setExpoPushToken] = useState<string>();
    const [notification, setNotification] = useState<Notifications.Notification>();
    const notificationListener = useRef<Subscription>();
    const responseListener = useRef<Subscription>();

    useEffect(() => {
        notificationsHandler = setNotification;

        while (pendingNotifications.length > 0) {
            const pendingNotification = pendingNotifications.pop()!;
            notificationsHandler(pendingNotification);
        }

        registerForPushNotificationsAsync().then(setExpoPushToken).catch(setErrorMessage);

        notificationListener.current = notificationReceivedListener;

        responseListener.current = notificationResponseReceivedListener;

        return () => {
            notificationListener.current &&
                Notifications.removeNotificationSubscription(notificationListener.current);
            responseListener.current &&
                Notifications.removeNotificationSubscription(responseListener.current);
        };
    }, []);

    return (
        <ScrollView
            style={{ marginVertical: 16 }}
            contentContainerStyle={{
                flexGrow: 1,
                alignItems: 'center',
                justifyContent: 'space-around'
            }}
        >
            <View style={{ alignItems: 'center', marginVertical: 16 }}>
                <Text style={{ fontWeight: 'bold' }}>Your expo push token:</Text>
                {errorMessage ? (
                    <Text>{errorMessage}</Text>
                ) : expoPushToken ? (
                    <Text selectable={true}>{expoPushToken}</Text>
                ) : (
                    <Text>-</Text>
                )}
            </View>
            <View style={{ width: '100%', marginVertical: 16 }}>
                <Text style={{ fontWeight: 'bold', textAlign: 'center' }}>
                    Notification content
                </Text>
                {notification ? (
                    <JSONTree data={JSON.parse(JSON.stringify(notification))} />
                ) : (
                    <Text style={{ textAlign: 'center' }}>-</Text>
                )}
            </View>
            <View>
                <TouchableOpacity
                    onPress={schedulePushNotification}
                    style={{ backgroundColor: 'lightgreen', padding: 8, marginVertical: 8 }}
                >
                    <Text>Press to schedule a notification</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setNotification(undefined)}
                    style={{ backgroundColor: 'lightcoral', padding: 8, marginVertical: 8 }}
                >
                    <Text style={{ color: 'white', textAlign: 'center' }}>Clear notification</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}
