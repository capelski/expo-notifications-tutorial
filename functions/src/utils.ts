import Expo, { ExpoPushMessage } from 'expo-server-sdk';
import * as functions from 'firebase-functions';
import fetch from 'node-fetch';
import config from './config.json';

type CityData = {
    maxTemperature: number;
    minTemperature: number;
    temperature: number;
    weatherIcon: string;
    weatherName: string;
    windSpeed: number;
};

type WeatherResponse = { ok: true; data: CityData } | { ok: false; data: string };

const getWeatherData = (city: string): Promise<WeatherResponse> =>
    fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${config.WEATHER_API_KEY}`
    )
        .then((response) =>
            response.json().then((responseContent) => ({
                ok: response.ok,
                data: response.ok
                    ? {
                          maxTemperature: responseContent.main.temp_max,
                          minTemperature: responseContent.main.temp_min,
                          temperature: responseContent.main.temp,
                          weatherIcon: `http://openweathermap.org/img/w/${responseContent.weather[0].icon}.png`,
                          weatherName: responseContent.weather[0].main,
                          windSpeed: responseContent.wind.speed
                      }
                    : responseContent.message || JSON.stringify(responseContent)
            }))
        )
        .catch((error) => ({
            ok: false,
            data: error.message || JSON.stringify(error)
        }));

export const sendPushNotifications = (pushTokens: string[]) => {
    return getWeatherData('Barcelona').then((response) => {
        if (response.ok) {
            // Build the notifications with Expo format
            const expoPushMessages: ExpoPushMessage[] = pushTokens.map((pushToken) => ({
                body: `${response.data.temperature} ºC`,
                data: response.data,
                title: `Barcelona is ${response.data.weatherName} today`,
                to: pushToken
            }));

            const expo = new Expo();
            return expo
                .sendPushNotificationsAsync(expoPushMessages)
                .then(() => {
                    /* Note that expo.sendPushNotificationsAsync will not send the push notifications
                     * to the user immediately but will send the information to Expo notifications
                     * service instead, which will later send the notifications to the users
                     * (yes, Expo might fail to send it, but usually doesn't happen) */

                    functions.logger.log('Push notifications requested correctly');
                    return null;
                })
                .catch((error) => {
                    functions.logger.error(`Error requesting push notifications`, error);
                    return null;
                });
        } else {
            functions.logger.error('Error fetching the weather data', response.data);
            return null;
        }
    });
};
