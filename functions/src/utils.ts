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

export const getWeatherData = (city: string): Promise<WeatherResponse> =>
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
