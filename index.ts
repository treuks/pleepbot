import { ChatClient } from "@kararty/dank-twitch-irc";
import { Database } from "bun:sqlite";
import Bun from "bun";

const db = new Database("pleep.db", { create: true });

const BOT_USERNAME = Bun.env.PLEEPY_BOTNAME;

if (BOT_USERNAME === null) {
	throw "PLEEPY_BOTNAME environmental variable is empty.";
}

const OAUTH_TOKEN = Bun.env.PLEEPY_PASS;

if (OAUTH_TOKEN === null) {
	throw "OAUTH_TOKEN environmental variable is empty.";
}

const client = new ChatClient({
	username: BOT_USERNAME,
	password: OAUTH_TOKEN,
});

// rome-ignore lint/style/noNonNullAssertion: If it is empty then the bot should die regardless.
const CHANNEL_NAME = Bun.env.PLEEPY_CHANNEL!;

if (CHANNEL_NAME === null) {
	throw "PLEEPY_CHANNEL environmental variable is empty.";
}

/**
 * Get Username from the given Twitch ID.
 * @param {string} uid - Required Twitch ID
 * @example
 * // Returns the Username object
 * let username = getUsernameFromId.get({$uid: uid}) as UsernameObject
 */
const getUsernameFromId = db.query(
	"SELECT username FROM users WHERE uid = $uid;",
);
/**
 * Get Twitch UID from the Twitch Username.
 * @param {string} username - Required Twitch Username
 * @example
 * // Returns a UID object
 * let uid = getUidFromUsername.get({$username: username}) as UidObject
 */
const getUidFromUsername = db.query(
	"SELECT uid FROM users WHERE username = $username;",
);
/**
 * Get Points from the Twitch UID.
 * @param {string} uid - Required Twitch UID
 * @example
 * // Returns a Points object
 * let points = getUserPointsFromId.get({$uid: uid}) as PointObject
 */
const getUserPointsFromId = db.query(
	"SELECT points FROM users WHERE uid = $uid;",
);
/**
 * Updates Points for given user.
 * @param {string} uid - Required Twitch UID
 * @example
 * // Returns nothing, basically.
 * updatePointsForId.run({ $points: points, $uid: uid })
 */
const updatePointsForId = db.query(
	"UPDATE users SET points = $points WHERE uid = $uid;",
);

const userIsInDatabase = (username: string): boolean => {
	const userData = getUidFromUsername.get({ $username: username });
	if (userData === null) {
		return false;
	}
	return true;
};

const isRegistered = (uid: string): boolean => {
	const userData = getUsernameFromId.get({ $uid: uid });
	if (userData === null) {
		return false;
	}
	return true;
};

type Points = {
	points: number;
};

type Uid = {
	uid: number;
};

// type Username = {
//   username: string;
// };

const gamba = (
	currentAmount: number,
	betAmount: number,
	userId: string,
	messageId: string,
) => {
	// Coin Flip
	const coinflip = Math.round(Math.random());
	const won = coinflip > 0;

	if (betAmount === currentAmount) {
		if (won === true) {
			updatePointsForId.run({ $points: currentAmount * 2, $uid: userId });
			client.reply(
				CHANNEL_NAME,
				messageId,
				`pogs You almost lost everything, but you didn't! You now have ${
					currentAmount * 2
				} 🪙 pleeps!`,
			);
		} else {
			updatePointsForId.run({ $points: 0, $uid: userId });
			client.reply(
				CHANNEL_NAME,
				messageId,
				`SadgeCry You lost everything! ${currentAmount} 🪙 pleeps down the drain!`,
			);
		}
	}

	if (won === true) {
		updatePointsForId.run({
			$points: currentAmount + betAmount * 2,
			$uid: userId,
		});
		client.reply(
			CHANNEL_NAME,
			messageId,
			`pleep You won! And now have ${currentAmount + betAmount * 2} 🪙 pleeps!`,
		);
	} else {
		updatePointsForId.run({
			$points: currentAmount - betAmount,
			$uid: userId,
		});
		client.reply(
			CHANNEL_NAME,
			messageId,
			`GAMBA You lost ${betAmount} 🪙 pleeps! You now have ${
				currentAmount - betAmount
			} 🪙 pleeps!`,
		);
	}
};

client.on("ready", () => console.log("Successfully connected to chat"));
client.on("close", (error) => {
	db.close();
	if (error != null) {
		console.error("Client closed due to error", error);
	}
});

client.on("PRIVMSG", (msg) => {
	console.log(`[#${msg.channelName}] ${msg.displayName}: ${msg.messageText}`);

	if (msg.messageText.startsWith("!")) {
		const messageArgs = msg.messageText.substring(1).split(" ");

		if (messageArgs[0] === "pleep") {
			client.privmsg(CHANNEL_NAME, "pleep");
		}

		if (messageArgs[0] === "register") {
			const createUserFromTemplate = db.query(
				"INSERT INTO users (uid, username, points) VALUES ($uid, $username, $points);",
			);
			if (isRegistered(msg.senderUserID) === true) {
				client.privmsg(
					CHANNEL_NAME,
					"Hmm It looks like you have already registered. Carry on!",
				);
			}
			createUserFromTemplate.run({
				$uid: msg.senderUserID,
				$username: msg.senderUsername,
				$points: 150,
			});
			client.privmsg(
				CHANNEL_NAME,
				"You registered and got 150 free 🪙 pleeps! Nice!",
			);
		}

		if (messageArgs[0] === "pleeps") {
			if (messageArgs.length > 1 && messageArgs[1].startsWith("@")) {
				const strippedUser = messageArgs[1].trim().toLowerCase().substring(1);
				if (userIsInDatabase(strippedUser) === false) {
					client.privmsg(
						CHANNEL_NAME,
						"pleep I don't recognize that user. Are they registered?",
					);
					return;
				}
				const uid = getUidFromUsername.get({
					$username: strippedUser,
				}) as Uid;
				const points = getUserPointsFromId.get({
					$uid: uid.uid,
				}) as Points;
				client.privmsg(
					CHANNEL_NAME,
					`${messageArgs[1]} has ${points.points} pleeps.`,
				);
				return;
			}
			if (isRegistered(msg.senderUserID) === false) {
				client.privmsg(
					CHANNEL_NAME,
					"pleep You are not registered! Type !register in chat to register!",
				);
				return;
			}
			const points = getUserPointsFromId.get({
				$uid: msg.senderUserID,
			}) as Points;

			client.reply(
				CHANNEL_NAME,
				msg.messageID,
				`You have ${points.points} pleeps!`,
			);
		}

		if (messageArgs[0] === "gamba") {
			if (isRegistered(msg.senderUserID) === false) {
				client.privmsg(
					CHANNEL_NAME,
					"pleep You are not registered! Type !register in chat to register!",
				);
				return;
			}
			const points = getUserPointsFromId.get({
				$uid: msg.senderUserID,
			}) as Points;

			if (points.points <= 0) {
				client.reply(
					CHANNEL_NAME,
					msg.messageID,
					"pleep You are out of pleeps!",
				);
				return;
			}

			if (messageArgs[1] === "all") {
				gamba(points.points, points.points, msg.senderUserID, msg.messageID);
				return;
			}

			if (Number.isNaN(Number(messageArgs[1]))) {
				client.reply(
					CHANNEL_NAME,
					msg.messageID,
					"pleep I don't think that's a number",
				);
				return;
			}

			if (Number(messageArgs[1]) < 0) {
				client.reply(CHANNEL_NAME, msg.messageID, "forsenCD Nice try buddy");
				return;
			}
			if (Number(messageArgs[1]) === 0) {
				client.reply(CHANNEL_NAME, msg.messageID, "Erm ...");
				return;
			}

			if (points.points < Number(messageArgs[1])) {
				client.reply(
					CHANNEL_NAME,
					msg.messageID,
					`pleep Sorry, you only have ${points.points} 🪙 pleeps!`,
				);
				return;
			}

			gamba(
				points.points,
				Number(messageArgs[1]),
				msg.senderUserID,
				msg.messageID,
			);
		}
	}
});

client.connect();
client.join(CHANNEL_NAME);
