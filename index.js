import bolt from "@slack/bolt";
import cron from "node-cron";
import got from "got";
import dotenv from "dotenv";
import moment from "moment";

dotenv.config();

const openWeatherMapApiKey = process.env.OPENWEATHERMAP_APIKEY;

let lastMessageChannel = 0;
let lastMessageTs = 0;

const app = new bolt.App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_TOKEN,
});

const timeMap = {
  one: "13:30",
  two: "14:00",
  three: "14:30",
  four: "15:00",
  five: "15:30",
};

(async () => {
  // Start the app
  await app.start();
  console.log("⚡️ Bolt app is running!");

  // sendQuestion();
  cron.schedule("00 12 * * 1,4", () => sendQuestion());
  cron.schedule("00 13 * * 1,4", () => checkResponses());
})();

const sendQuestion = async () => {
	console.log('sendQuestion');
  const weatherData = await got
    .get("http://api.openweathermap.org/data/2.5/onecall", {
      searchParams: {
        appid: openWeatherMapApiKey,
        lat: "51.1418856",
        lon: "4.4408114",
        units: "metric",
		lang: 'nl'
      },
    })
    .json();

	const chatMessage = await app.client.chat.postMessage({
		channel: process.env.SLACK_CHANNEL,
		blocks: [
			{
				"type": "header",
				"text": {
					"type": "plain_text",
					"text": "Wanner gaan we wandelen?",
					"emoji": true
				}
			},
			{
				"type": "divider"
			},
			...Object.keys(timeMap).map((emoji) => {
				const time = moment().set('hours', timeMap[emoji].split(':')[0]).set('minutes', timeMap[emoji].split(':')[1]).set('seconds', 0).unix();
				const weather = weatherData.hourly.find((x) => x.dt >= time && x.dt <= time + 30 * 60);
				const rain = weather.rain ? `(${Object.keys(weather.rain)[0]} - ${weather.rain[Object.keys(weather.rain)[0]]}%)` : ''

				return {
					"type": "section",
					"text": {
						"type": "mrkdwn",
						"text": `:${emoji}: *${timeMap[emoji]}* - ${weather.weather[0].description} ${rain}\n\n*Temperatuur*: ${weather.feels_like}c\n*Vochtigheid*: ${weather.humidity}%` 
					},
					"accessory": {
						"type": "image",
						"image_url": `http://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png`,
						"alt_text": "image"
					}
				};
			})
		],
	});

  Object.keys(timeMap).reduce(async (acc, emoji) => {
    await acc;

    return new Promise((resolve) => {
      setTimeout(() => {
        app.client.reactions
          .add({
            name: emoji,
            timestamp: chatMessage.ts,
            channel: chatMessage.channel,
          })
          .then(resolve);
      }, 1000);
    });
  }, Promise.resolve());

  lastMessageTs = chatMessage.ts;
  lastMessageChannel = chatMessage.channel;
};

const checkResponses = async () => {
	console.log('checkResponses', lastMessageTs, lastMessageChannel);
  const { message } = await app.client.reactions.get({
    channel: lastMessageChannel,
    timestamp: lastMessageTs,
    full: true,
  });

  const max = message.reactions
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)
    .reduce(function (prev, current) {
      return prev.count > current.count ? prev : current;
    });

  const chatMessage = await app.client.chat.postMessage({
    channel: process.env.SLACK_CHANNEL,
    text: `Wandeltijd: *${timeMap[max.name]}*`,
  });
};
