require('dotenv').config();
const express = require('express');
axios = require("axios");
const app = express();

const port = process.env.PORT || 5000;
const baseUrl = process.env.BASE_URL;
const userKey = process.env.USER_KEY;

const SESSION_LIMIT = 600000

const headers = {
    Accept: "application/json",
};
const params = { userKey }

app.listen(port, () => console.log(`Listening on port ${port}`));

class SessionTracker {
    constructor(user = "") {
        this.events = [];
        this.user = user;
    }

    recordVisit = ({ url, timestamp }) => {
        this.events.push({ timestamp, url })
    }

    getSessions = () => {
        const orderedEvents = this.events.sort((a, b) => a.timestamp - b.timestamp)
        let current = orderedEvents[0].timestamp;
        let start = orderedEvents[0].timestamp;
        let pages = [orderedEvents[0].url];
        const sessions = [];
        for (let i = 1; i < orderedEvents.length; i++) {
            if (orderedEvents[i].timestamp - current <= SESSION_LIMIT) {
                pages.push(orderedEvents[i].url)
            } else {
                sessions.push({ duration: current - start, pages, startTime: start })
                pages = [orderedEvents[i].url];
                start = orderedEvents[i].timestamp;
            }
            if (i === orderedEvents.length - 1) {
                sessions.push({ duration: orderedEvents[i].timestamp - start, pages, startTime: start })
            }
            current = orderedEvents[i].timestamp;
        }
        if (orderedEvents.length === 1) {
            sessions.push({ duration: 0, pages, startTime: start })
        }
        return sessions
    }
}

class Visitors {
    constructor(events) {
        this.users = this.getUsers(events);
    }

    getUsers = (events) => {
        const users = {};
        events.forEach(({ url, visitorId, timestamp }) => {
            if (!users[visitorId]) {
                users[visitorId] = new SessionTracker(visitorId)
            }
            users[visitorId].recordVisit({ url, timestamp })
        });
        return users;
    }

    getSessionsByUser = () => {
        const { users } = this;
        const sessions = {}
        for (let user in users) {
            sessions[user] = users[user].getSessions()
        }
        return sessions
    }
}


app.get('/api/events', async (req, res) => {
    try {
        const { data } = await axios.get(`${baseUrl}/dataset`, { params, headers })
        const { events } = data;
        res.send({ events });
    } catch (err) {
        console.log("Error", err.response.status)
        res.status(err.response.status).send(err.message);
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const { data } = await axios.get(`${baseUrl}/dataset`, { params, headers })
        const { events } = data;
        let filtered = events.filter(({ visitorId }) => visitorId === req.query.user).sort((a, b) => a.timestamp - b.timestamp)
        res.send({ events: filtered });
    } catch (err) {
        console.log("Error", err.response.status)
        res.status(err.response.status).send(err.message);
    }
});

app.get('/api/sessions', async (req, res) => {

    try {
        const { data } = await axios.get(`${baseUrl}/dataset`, { params, headers })
        const { events } = data;
        const visitors = new Visitors(events)
        const sessionsByUser = visitors.getSessionsByUser()

        res.send({ sessionsByUser });

        axios.post(`${baseUrl}/result`, { sessionsByUser }, { params })
            .then(res => {
                console.log(res.status == 200 ? "success" : "failed")
            }).catch((error) => {
                console.log("failed", error.message);
            })
    } catch (err) {
        console.log("Error", err.response.status)
        res.status(err.response.status).send(err.message);
    }
}); 