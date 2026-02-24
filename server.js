// server.js - simple Node/Express backend for SosyalTrend
// this file implements the minimal API used by assets/js/api.js

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const DATA_FILE = path.join(__dirname, 'data.json');
let db = { users: [], posts: [] };

function loadDB() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        } catch (e) {
            console.error('Veri dosyası okunamadı:', e);
        }
    }
}

const BCRYPT_ROUNDS = 10;  // adjust as needed

function saveDB() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error('Veri dosyası yazılamadı:', e);
    }
}

loadDB();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
    secret: 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true }
}));

// --- passport/Google OAuth setup ----------------------------------------
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser((id, done) => {
    const u = findUserById(id);
    done(null, filterOutSensitive(u));
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET',
    callbackURL: '/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
    // try to locate existing user by googleId or email
    let user = db.users.find(u => u.googleId === profile.id || (u.email && profile.emails && u.email === profile.emails[0].value));
    if (!user) {
        const id = Date.now().toString();
        user = {
            id,
            googleId: profile.id,
            email: profile.emails && profile.emails[0].value,
            username: profile.emails && profile.emails[0].value.split('@')[0],
            displayName: profile.displayName || '',
            password: '',
            avatarUrl: (profile.photos && profile.photos[0].value) || 'assets/img/strendsaydamv2.png',
            role: 'user',
            friends: [],
            sentRequests: [],
            friendRequests: []
        };
        db.users.push(user);
        saveDB();
    }
    done(null, user);
}));

// OAuth routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth/login.html' }),
    (req, res) => {
        req.session.user = filterOutSensitive(req.user);
        res.redirect('/index.html');
    }
);

// --- helpers ---------------------------------------------------------------
function findUserByEmail(email) {
    return db.users.find(u => u.email === email);
}

function findUserById(uid) {
    return db.users.find(u => u.id === uid);
}

function filterOutSensitive(user) {
    if (!user) return null;
    const { password, ...rest } = user;
    return rest;
}

// --- auth endpoints -------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = findUserByEmail(email);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const match = await bcrypt.compare(password || '', user.password || '');
    if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.user = filterOutSensitive(user);
    res.json(req.session.user);
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error(err);
        res.json({});
    });
});

app.get('/api/auth/me', (req, res) => {
    if (req.session && req.session.user) {
        return res.json(req.session.user);
    }
    res.status(401).json({ error: 'not logged in' });
});

// --- users ----------------------------------------------------------------
app.get('/api/users', (req, res) => {
    if (req.query.username) {
        const u = db.users.find(u => u.username === req.query.username);
        return res.json(filterOutSensitive(u));
    }
    const list = db.users.map(filterOutSensitive);
    res.json(list);
});

app.get('/api/users/:uid', (req, res) => {
    const u = findUserById(req.params.uid);
    res.json(filterOutSensitive(u));
});

app.put('/api/users/:uid', (req, res) => {
    const u = findUserById(req.params.uid);
    if (!u) return res.status(404).json({ error: 'user not found' });
    Object.assign(u, req.body);
    saveDB();
    res.json(filterOutSensitive(u));
});

app.get('/api/users/suggestions', (req, res) => {
    const limit = parseInt(req.query.limit || '20', 10);
    const current = req.session.user;
    let list = db.users.slice();
    list.sort(() => Math.random() - 0.5);
    if (current) {
        const sent = (current.sentRequests||[]).map(r => r.toUid);
        list = list.filter(u => u.id !== current.id &&
                               !(current.friends||[]).includes(u.id) &&
                               !sent.includes(u.id));
    }
    res.json(list.slice(0, limit));
});

// --- additional auth helpers --------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
    const { email, password, username, displayName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email/password required' });
    if (findUserByEmail(email)) return res.status(400).json({ error: 'email exists' });
    if (username && db.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'username exists' });
    }
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = Date.now().toString();
    const newUser = {
        id,
        email,
        password: hashed,
        username: username || email.split('@')[0],
        displayName: displayName || '',
        avatarUrl: 'assets/img/strendsaydamv2.png',
        role: 'user',
        friends: [],
        sentRequests: [],
        friendRequests: []
    };
    db.users.push(newUser);
    saveDB();
    req.session.user = filterOutSensitive(newUser);
    res.json(req.session.user);
});

app.post('/api/auth/change-password', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'not logged in' });
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'weak password' });
    const u = findUserById(req.session.user.id);
    if (u) {
        u.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        saveDB();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'user not found' });
    }
});

app.post('/api/auth/change-email', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'not logged in' });
    const { newEmail } = req.body;
    if (!newEmail || !newEmail.includes('@')) return res.status(400).json({ error: 'invalid email' });
    if (findUserByEmail(newEmail)) return res.status(400).json({ error: 'email exists' });
    const u = findUserById(req.session.user.id);
    if (u) {
        u.email = newEmail;
        saveDB();
        req.session.user.email = newEmail;
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'user not found' });
    }
});

app.post('/api/auth/reset-password', (req, res) => {
    const { email } = req.body;
    const u = findUserByEmail(email);
    if (!u) return res.status(404).json({ error: 'user not found' });
    u.password = 'reset123';
    saveDB();
    res.json({ success: true, newPassword: 'reset123' });
});

// --- posts ------------------------------------------------------------------
app.get('/api/posts', (req, res) => {
    let list = db.posts.slice();
    if (req.query.username) {
        list = list.filter(p => p.username === req.query.username);
    }
    res.json(list);
});

app.post('/api/posts', (req, res) => {
    const post = req.body;
    post.id = Date.now().toString();
    post.timestamp = Date.now();
    db.posts.push(post);
    saveDB();
    res.json(post);
});

app.put('/api/posts/:id', (req, res) => {
    const p = db.posts.find(p => p.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'post not found' });
    Object.assign(p, req.body);
    saveDB();
    res.json(p);
});

app.delete('/api/posts/:id', (req, res) => {
    db.posts = db.posts.filter(p => p.id !== req.params.id);
    saveDB();
    res.json({ success: true });
});

// --- friends --------------------------------------------------------------
app.post('/api/friends/request', (req, res) => {
    const { fromUid, toUid } = req.body;
    const from = findUserById(fromUid);
    const to = findUserById(toUid);
    if (!from || !to) return res.status(404).json({ error: 'user not found' });

    const now = Date.now();
    const request = { fromUid, toUid, timestamp: now, status: 'pending' };

    to.friendRequests = to.friendRequests || [];
    to.friendRequests.push(request);

    from.sentRequests = from.sentRequests || [];
    from.sentRequests.push(request);

    saveDB();
    res.json({ success: true });
});

app.post('/api/friends/cancel', (req, res) => {
    const { fromUid, toUid } = req.body;
    const from = findUserById(fromUid);
    const to = findUserById(toUid);
    if (!from || !to) return res.status(404).json({ error: 'user not found' });

    from.sentRequests = (from.sentRequests||[]).filter(r => r.toUid !== toUid);
    to.friendRequests = (to.friendRequests||[]).filter(r => r.fromUid !== fromUid);
    saveDB();
    res.json({ success: true });
});

// --- static files (serve front-end) ---------------------------------------
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Server started on port', PORT);
});
