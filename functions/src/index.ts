import Expo, { ExpoPushMessage } from 'expo-server-sdk';
import * as firebase from 'firebase-admin';
import * as functions from 'firebase-functions';
import { getWeatherData } from './utils';

firebase.initializeApp();

export const dailyWeatherNotification = functions.pubsub
    .schedule('0 8 * * *')
    .timeZone('Europe/Madrid')
    .onRun(() => {
        return firebase
            .database()
            .ref('subscriptions')
            .once('value')
            .then((subscriptionsSnapshot) => {
                const subscriptions = subscriptionsSnapshot.val();

                if (!subscriptions) {
                    functions.logger.log(`No subscriptions on ${new Date().toLocaleDateString()}`);
                    return null;
                } else {
                    const pushTokens = Object.keys(subscriptions).filter(
                        (pushToken) => subscriptions[pushToken] === true
                    );

                    if (pushTokens.length === 0) {
                        functions.logger.log(
                            `No active subscriptions on ${new Date().toLocaleDateString()}`
                        );
                        return null;
                    } else {
                        return getWeatherData('Barcelona').then((response) => {
                            if (response.ok) {
                                // Build the notifications with Expo format
                                const expoPushMessages: ExpoPushMessage[] = pushTokens.map(
                                    (pushToken) => ({
                                        body: `${response.data.temperature} ºC`,
                                        data: response.data,
                                        title: `Barcelona is ${response.data.weatherName} today`,
                                        to: pushToken
                                    })
                                );

                                const expo = new Expo();
                                return expo
                                    .sendPushNotificationsAsync(expoPushMessages)
                                    .then(() => {
                                        /* Note that expo.sendPushNotificationsAsync will not send the push notifications
                                         * to the user immediately but will send the information to Expo notifications
                                         * service instead, which will later send the notifications to the users
                                         * (yes, Expo might fail to send it, but usually doesn't happen) */

                                        functions.logger.log(
                                            'Push notifications requested correctly'
                                        );
                                        return null;
                                    })
                                    .catch((error) => {
                                        functions.logger.error(
                                            `Error requesting push notifications`,
                                            error
                                        );
                                        return null;
                                    });
                            } else {
                                functions.logger.error(
                                    'Error fetching the weather data',
                                    response.data
                                );

                                return null;
                            }
                        });
                    }
                }
            })
            .catch((error) => {
                functions.logger.error('Error reading the subscriptions', error);
                return null;
            });
    });
