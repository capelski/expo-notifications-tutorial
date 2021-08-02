import { Subscription } from '@unimodules/core';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import { Button, Platform, Text, View } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false
    })
});

const registerForPushNotificationsAsync = async () => {
    let token;
    if (Constants.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            throw 'Failed to get push token for push notification!';
        }
        token = (await Notifications.getExpoPushTokenAsync()).data;
    } else {
        throw 'Must use physical device for Push Notifications';
    }

    if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C'
        });
    }

    return token;
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

export default function App() {
    const [errorMessage, setErrorMessage] = useState<string>();
    const [expoPushToken, setExpoPushToken] = useState<string>();
    const [notification, setNotification] = useState<Notifications.Notification>();
    const notificationListener = useRef<Subscription>();
    const responseListener = useRef<Subscription>();

    useEffect(() => {
        registerForPushNotificationsAsync().then(setExpoPushToken).catch(setErrorMessage);

        notificationListener.current =
            Notifications.addNotificationReceivedListener(setNotification);

        responseListener.current = Notifications.addNotificationResponseReceivedListener(
            (response) => {
                setNotification(response.notification);
            }
        );

        return () => {
            notificationListener.current &&
                Notifications.removeNotificationSubscription(notificationListener.current);
            responseListener.current &&
                Notifications.removeNotificationSubscription(responseListener.current);
        };
    }, []);

    return (
        <View
            style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'space-around'
            }}
        >
            <View style={{ alignItems: 'center' }}>
                <Text>Your expo push token:</Text>
                {errorMessage ? (
                    <Text>{errorMessage}</Text>
                ) : expoPushToken ? (
                    <Text selectable={true}>{expoPushToken}</Text>
                ) : (
                    <Text>-</Text>
                )}
            </View>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Text>Title: {notification && notification.request.content.title} </Text>
                <Text>Body: {notification && notification.request.content.body}</Text>
                <Text>
                    Data: {notification && JSON.stringify(notification.request.content.data)}
                </Text>
            </View>
            <Button title="Press to schedule a notification" onPress={schedulePushNotification} />
        </View>
    );
}
