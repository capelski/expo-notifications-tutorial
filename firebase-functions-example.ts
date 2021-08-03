import Expo, { ExpoPushMessage } from 'expo-server-sdk';
import * as firebase from 'firebase-admin';
import * as functions from 'firebase-functions';

export const newCommentNotification = functions.database
    .ref('users/{userId}/posts/{postId}/comments/${commentId}') // Firebase Realtime database sample path
    .onCreate((snapshot, context) => {
        const comment = snapshot.val(); // Retrieve the comment object from database
        const commentId = context.params['commentId']; // Retrieve the comment Id from the Realtime database path
        const userId = context.params['userId']; // Retrieve the user Id from the Realtime database path

        /* Retrieve the user push token (e.g. from Realtime database).
         *    Prior to sending the push notification, the user's push token must be collected and stored
         *    in a location accessible from this function scope (not necessarily Realtime database) */
        return firebase
            .database()
            .ref(`pushTokens/${userId}`) // Firebase Realtime database sample path
            .once('value')
            .then((pushTokenSnapshot) => {
                const pushToken = pushTokenSnapshot.val();

                // Build the notification with Expo format
                const expoPushMessage: ExpoPushMessage = {
                    body: comment.content,
                    data: {
                        /* Optional additional data to be used in the app */
                    },
                    title: `${comment.author} commented on your post`,
                    to: pushToken
                };

                const expo = new Expo();
                return expo
                    .sendPushNotificationsAsync([expoPushMessage])
                    .then(() => {
                        /* Note that expo.sendPushNotificationsAsync will not send the push notification
                         * to the user immediately but will send the information to Expo notifications
                         * service instead, which will later send the notification to the user
                         * (yes, Expo might fail to send it, but usually doesn't happen) */

                        functions.logger.log('Push notification requested correctly');
                        return null; // Firebase Functions expects null to be returned when function finishes
                    })
                    .catch((error) => {
                        functions.logger.error(
                            `Error requesting push notification for comment ${commentId}`,
                            error
                        );
                        return null; // Firebase Functions expects null to be returned when function finishes
                    });
            })
            .catch((error) => {
                functions.logger.error(`Error obtaining push token for user ${userId}`, error);
                return null; // Firebase Functions expects null to be returned when function finishes
            });
    });
