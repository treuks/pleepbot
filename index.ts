import { ChannelIRCMessage, ChatClient } from '@kararty/dank-twitch-irc'
import { Database } from "bun:sqlite";

const db = new Database("pleep.db", { create: true });

const isRegistered = (uid: string): boolean => {
	const getUsernameFromId = db.query("SELECT username FROM users WHERE uid = $uid;")
	let userData = getUsernameFromId.get({ $uid: uid })
	if (userData == undefined) {
		return false
	} else {
		return true
	}
}

const getUserPoints = db.query("SELECT points FROM users WHERE uid = $uid;")
const updatePointsForId = db.query("UPDATE users SET points = $points WHERE uid = $uid;")

type PointObject = {
	points: number
}

class GambaClass {
	won: boolean
	amount: number
	all: boolean
	constructor(won: boolean, amount: number, all: boolean) {
		this.won = won
		this.amount = amount
		this.all = all
	}
}

const gamba = (currentAmount: number, betAmount: number, userId: string, messageId: string) => {

	// Coin Flip
	let coinflip = Math.round(Math.random())
	let won = coinflip > 0

	if (betAmount == currentAmount) {
		if (won == true) {
			updatePointsForId.run({ $points: currentAmount * 2, $uid: userId })
			client.reply(CHANNEL_NAME, messageId, `pogs You almost lost everything, but you didn't! You now have ${currentAmount * 2} points!`)
		} else {
			updatePointsForId.run({ $points: 0, $uid: userId })
			client.reply(CHANNEL_NAME, messageId, `SadgeCry You lost everything! ${currentAmount} points down the drain!`)
		}
	}

	if (won == true) {
		updatePointsForId.run({ $points: currentAmount + (betAmount * 2), $uid: userId })
		client.reply(CHANNEL_NAME, messageId, `pleep You won! And now have ${currentAmount + (betAmount * 2)} points!`)
	} else {
		updatePointsForId.run({ $points: currentAmount - betAmount, $uid: userId })
		client.reply(CHANNEL_NAME, messageId, `GAMBA You lost ${betAmount} points! You now have ${currentAmount - betAmount}`)
	}

}

let client = new ChatClient({
	username: 'pleepybot',
	password: Bun.env.PLEEPYPASS,
})
const CHANNEL_NAME = 'vedal987'


client.on('ready', () => console.log('Successfully connected to chat'))
client.on('close', (error) => {
	db.close()
	if (error != null) {
		console.error('Client closed due to error', error)
	}
})

client.on('PRIVMSG', (msg) => {
	console.log(`[#${msg.channelName}] ${msg.displayName}: ${msg.messageText}`)

	if (msg.messageText.startsWith('!')) {
		let messageArgs = msg.messageText.substring(1).split(' ')

		if (messageArgs[0] == 'pleep') {
			client.privmsg(CHANNEL_NAME, 'pleep')
		}

		if (messageArgs[0] == 'register') {
			const createUserFromTemplate = db.query("INSERT INTO users (uid, username, points) VALUES ($uid, $username, $points);")
			if (isRegistered(msg.senderUserID) == true) {
				client.privmsg(CHANNEL_NAME, "Hmm It looks like you have already registered. Carry on!")
			}
			createUserFromTemplate.run({ $uid: msg.senderUserID, $username: msg.senderUsername, $points: 150 })
			client.privmsg(CHANNEL_NAME, "You registered and got 150 free GAMBA points! Nice!")
		}

		if (messageArgs[0] == 'points') {

			if (isRegistered(msg.senderUserID) == false) {
				client.privmsg(CHANNEL_NAME, "pleep You are not registered! Type !register in chat to register!")
				return
			}
			let points = getUserPoints.get({ $uid: msg.senderUserID }) as PointObject

			client.reply(CHANNEL_NAME, msg.messageID, `You have ${points.points} GAMBA points!`)
		}

		if (messageArgs[0] == 'gamba') {
			if (isRegistered(msg.senderUserID) == false) {
				client.privmsg(CHANNEL_NAME, "pleep You are not registered! Type !register in chat to register!")
				return
			}
			let points = getUserPoints.get({ $uid: msg.senderUserID }) as PointObject

			if (messageArgs[1] == 'all') {
				gamba(points.points, points.points, msg.senderUserID, msg.messageID)
			}

			if (isNaN(Number(messageArgs[1]))) {
				client.reply(CHANNEL_NAME, msg.messageID, `pleep I don't think that's a number`)
				return
			}

			if (points.points <= 0) {
				client.reply(CHANNEL_NAME, msg.messageID, `pleep You are out of points!`)
				return
			}


			if (Number(messageArgs[1]) < 0) {
				client.reply(CHANNEL_NAME, msg.messageID, `forsenCD Nice try buddy`)
				return
			}
			if (Number(messageArgs[1]) == 0) {
				client.reply(CHANNEL_NAME, msg.messageID, `Erm ...`)
				return
			}

			if (points.points < Number(messageArgs[1])) {
				client.reply(CHANNEL_NAME, msg.messageID, `pleep Sorry, you only have ${points.points} points!`)
				return
			}

			gamba(points.points, Number(messageArgs[1]), msg.senderUserID, msg.messageID)
		}
	}
})

client.connect()
client.join('vedal987')
