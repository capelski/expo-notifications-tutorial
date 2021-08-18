import firebase from 'firebase';
import firebaseConfig from './firebase-config.json';

type UISetters = {
    setErrorMessage: (errorMessage: string | undefined) => void;
    setIsLoading: (isLoading: boolean) => void;
    setIsSubscribed: (isSubscribed: boolean) => void;
};

const firebaseApp =
    firebase.apps[0] || // To prevent Expo Go client errors
    firebase.initializeApp({
        apiKey: firebaseConfig.API_KEY,
        authDomain: firebaseConfig.AUTH_DOMAIN,
        databaseURL: firebaseConfig.DATABASE_URL,
        storageBucket: firebaseConfig.STORAGE_BUCKET
    });

const getSubscriptionKey = (expoPushToken: string) =>
    expoPushToken.split('[')[1].replace(/\]/g, '');

export const modifyWeatherSubscription = (
    pushToken: string,
    isActive: boolean,
    setters: UISetters
) => {
    try {
        setters.setErrorMessage(undefined);
        setters.setIsLoading(true);
        firebaseApp
            .database()
            .ref(`subscriptions/${getSubscriptionKey(pushToken)}`)
            .set({ active: isActive, token: pushToken })
            .then(() => setters.setIsSubscribed(isActive))
            .catch((error) => setters.setErrorMessage(error.message || error))
            .finally(() => setters.setIsLoading(false));
    } catch (error) {
        setters.setErrorMessage(error.message || error);
    }
};

export const retrieveWeatherSubscription = (pushToken: string, setters: UISetters) => {
    try {
        setters.setIsLoading(true);
        firebase
            .database()
            .ref(`subscriptions/${getSubscriptionKey(pushToken)}`)
            .once('value')
            .then((subscriptionSnapshot) => {
                const subscription = subscriptionSnapshot.val();
                setters.setIsSubscribed(subscription && subscription.active);
            })
            .catch((error) => setters.setErrorMessage(error.message || error))
            .finally(() => setters.setIsLoading(false));
    } catch (error) {
        setters.setErrorMessage(error.message || error);
    }
};

export const testSubscription = (pushToken: string, setters: UISetters) => {
    try {
        setters.setErrorMessage(undefined);
        setters.setIsLoading(true);
        fetch(`${firebaseConfig.TEST_NOTIFICATION_ENDPOINT}?token=${pushToken}`)
            .then((response) => {
                if (!response.ok) {
                    setters.setErrorMessage('Something went wrong 🤔');
                }
            })
            .catch((error) => setters.setErrorMessage(error.message || error))
            .finally(() => setters.setIsLoading(false));
    } catch (error) {
        setters.setErrorMessage(error.message || error);
    }
};
