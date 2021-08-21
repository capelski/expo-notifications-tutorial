import { Subscription } from '@unimodules/core';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import JSONTree from 'react-native-json-tree';
import {
    modifyWeatherSubscription,
    retrieveWeatherSubscription,
    testSubscription
} from './server-operations';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false
    })
});

const getPushToken = () => {
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
            .then((tokenData) => tokenData.data);
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

export default function App() {
    const [errorMessage, setErrorMessage] = useState<string>();
    const [expoPushToken, setExpoPushToken] = useState<string>();
    const [isLoading, setIsLoading] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [notification, setNotification] = useState<Notifications.Notification>();
    const notificationListener = useRef<Subscription>();
    const responseListener = useRef<Subscription>();

    useEffect(() => {
        notificationsHandler = setNotification;

        while (pendingNotifications.length > 0) {
            const pendingNotification = pendingNotifications.pop()!;
            notificationsHandler(pendingNotification);
        }

        getPushToken()
            .then((pushToken) => {
                setExpoPushToken(pushToken);
                if (pushToken) {
                    retrieveWeatherSubscription(pushToken, {
                        setErrorMessage,
                        setIsLoading,
                        setIsSubscribed
                    });
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
                                    : () =>
                                          modifyWeatherSubscription(expoPushToken, !isSubscribed, {
                                              setErrorMessage,
                                              setIsLoading,
                                              setIsSubscribed
                                          })
                            }
                            style={{
                                backgroundColor: isSubscribed ? 'lightcoral' : 'lightgreen',
                                padding: 8
                            }}
                        >
                            <Text>{isSubscribed ? 'Unsubscribe' : 'Subscribe'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={
                                isLoading
                                    ? undefined
                                    : () =>
                                          testSubscription(expoPushToken, {
                                              setErrorMessage,
                                              setIsLoading,
                                              setIsSubscribed
                                          })
                            }
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
