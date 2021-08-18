import * as firebase from 'firebase-admin';
import * as functions from 'firebase-functions';
import { sendPushNotifications } from './utils';

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
                    const pushTokens = Object.keys(subscriptions)
                        .filter((subscriptionKey) => subscriptions[subscriptionKey].active === true)
                        .map((subscriptionKey) => subscriptions[subscriptionKey].token);

                    if (pushTokens.length === 0) {
                        functions.logger.log(
                            `No active subscriptions on ${new Date().toLocaleDateString()}`
                        );
                        return null;
                    } else {
                        return sendPushNotifications(pushTokens);
                    }
                }
            })
            .catch((error) => {
                functions.logger.error('Error reading the subscriptions', error);
                return null;
            });
    });

export const testNotification = functions.https.onRequest((req, res) => {
    const pushToken = req.query.token as string;

    if (!pushToken) {
        res.status(400).send({ ok: false, data: 'No pushToken provided' });
    } else {
        sendPushNotifications([pushToken]).then(() => {
            res.status(200).send({ ok: true });
        });
    }
});
