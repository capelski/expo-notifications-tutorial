import { Subscription } from '@unimodules/core';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import firebase from 'firebase';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import JSONTree from 'react-native-json-tree';
import firebaseConfig from './firebase-config.json';

const firebaseApp =
    firebase.apps[0] || // To prevent Expo Go client errors
    firebase.initializeApp({
        apiKey: firebaseConfig.API_KEY,
        authDomain: firebaseConfig.AUTH_DOMAIN,
        databaseURL: firebaseConfig.DATABASE_URL,
        storageBucket: firebaseConfig.STORAGE_BUCKET
    });

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

const getSubscriptionKey = (expoPushToken: string) =>
    expoPushToken.split('[')[1].replace(/\]/g, '');

export default function App() {
    const [errorMessage, setErrorMessage] = useState<string>();
    const [expoPushToken, setExpoPushToken] = useState<string>();
    const [isLoading, setIsLoading] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [notification, setNotification] = useState<Notifications.Notification>();
    const notificationListener = useRef<Subscription>();
    const responseListener = useRef<Subscription>();

    const modifyWeatherSubscription = (pushToken: string, isActive: boolean) => {
        try {
            setErrorMessage(undefined);
            setIsLoading(true);
            firebaseApp
                .database()
                .ref(`subscriptions/${getSubscriptionKey(pushToken)}`)
                .set({ active: isActive, token: pushToken })
                .then(() => setIsSubscribed(isActive))
                .catch((error) => setErrorMessage(error.message || error))
                .finally(() => setIsLoading(false));
        } catch (error) {
            setErrorMessage(error.message || error);
        }
    };

    const retrieveWeatherSubscription = (pushToken: string) => {
        try {
            setIsLoading(true);
            firebase
                .database()
                .ref(`subscriptions/${getSubscriptionKey(pushToken)}`)
                .once('value')
                .then((subscriptionSnapshot) => {
                    const subscription = subscriptionSnapshot.val();
                    setIsSubscribed(subscription && subscription.active);
                })
                .catch((error) => setErrorMessage(error.message || error))
                .finally(() => setIsLoading(false));
        } catch (error) {
            setErrorMessage(error.message || error);
        }
    };

    const testSubscription = (pushToken: string) => {
        try {
            setErrorMessage(undefined);
            setIsLoading(true);
            fetch(`${firebaseConfig.TEST_NOTIFICATION_ENDPOINT}?token=${pushToken}`)
                .then((response) => {
                    if (!response.ok) {
                        setErrorMessage('Something went wrong 🤔');
                    }
                })
                .catch((error) => setErrorMessage(error.message || error))
                .finally(() => setIsLoading(false));
        } catch (error) {
            setErrorMessage(error.message || error);
        }
    };

    useEffect(() => {
        notificationsHandler = setNotification;

        while (pendingNotifications.length > 0) {
            const pendingNotification = pendingNotifications.pop()!;
            notificationsHandler(pendingNotification);
        }

        registerForPushNotificationsAsync()
            .then((pushToken) => {
                setExpoPushToken(pushToken);
                if (pushToken) {
                    retrieveWeatherSubscription(pushToken);
                }
            })
            .catch(setErrorMessage);

        notificationListener.current = notificationReceivedListener;

        responseListener.current = notificationResponseReceivedListener;

        return () => {
            notificationListener.current &&
                Notifications.removeNotificationSubscription(notificationListener.current);
            responseListener.current &&
                Notifications.removeNotificationSubscription(responseListener.current);

            firebaseApp.delete();
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
                <Text style={{ fontSize: 22, marginBottom: 20, textAlign: 'center' }}>
                    Daily weather notification
                </Text>

                {expoPushToken && (
                    <View
                        style={{
                            alignItems: 'center',
                            opacity: isLoading ? 0.3 : undefined
                        }}
                    >
                        <TouchableOpacity
                            onPress={
                                isLoading
                                    ? undefined
                                    : () => modifyWeatherSubscription(expoPushToken, !isSubscribed)
                            }
                            style={{
                                backgroundColor: isSubscribed ? 'lightcoral' : 'lightgreen',
                                padding: 8
                            }}
                        >
                            <Text>{isSubscribed ? 'Unsubscribe' : 'Subscribe'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={isLoading ? undefined : () => testSubscription(expoPushToken)}
                            style={{ backgroundColor: 'lightblue', padding: 8, marginVertical: 8 }}
                        >
                            <Text>Send it now</Text>
                        </TouchableOpacity>
                    </View>
                )}
                <Text style={{ marginTop: 16 }}>Your expo push token:</Text>
                <Text selectable={true}>{expoPushToken || '-'}</Text>
            </View>

            {errorMessage && <Text style={{ color: 'red' }}>{errorMessage}</Text>}

            <View style={{ width: '100%', marginVertical: 16 }}>
                <Text style={{ fontWeight: 'bold', textAlign: 'center' }}>
                    Notification content
                </Text>
                {notification ? (
                    <React.Fragment>
                        <View
                            style={{
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center'
                            }}
                        >
                            <Image
                                height={96}
                                source={{
                                    uri: notification.request.content.data.weatherIcon as string
                                }}
                                style={{ height: 96, width: 96 }}
                                width={96}
                            />
                            <Text style={{ fontSize: 22 }}>
                                {notification.request.content.data.temperature as string} ºC
                            </Text>
                        </View>
                        <JSONTree data={JSON.parse(JSON.stringify(notification))} />
                        <TouchableOpacity
                            onPress={() => setNotification(undefined)}
                            style={{ backgroundColor: 'lightcoral', padding: 8, marginVertical: 8 }}
                        >
                            <Text style={{ color: 'white', textAlign: 'center' }}>
                                Clear notification
                            </Text>
                        </TouchableOpacity>
                    </React.Fragment>
                ) : (
                    <Text style={{ textAlign: 'center' }}>-</Text>
                )}
            </View>
        </ScrollView>
    );
}
