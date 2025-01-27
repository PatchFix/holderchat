const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const fs = require('fs');
const PORT = process.env.PORT || 3000;
const REG_USERS_FILE = './regUsers.json';
const WAIT_USERS_FILE = './regwaitUsers.json';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "https://signalgoat-59afef9ca102.herokuapp.com/",  // Be more specific in production
        methods: ["GET", "POST"]
    }
});

let lastCap = 0;
let netChange = 0;
let CONTRACTS = [];

let groups = {
    "example": {
        members: [],
        tokens: [],
        portal: "none"
    }
};

// Load registered users from file
let regUsers = {};
try {
    const data = fs.readFileSync(REG_USERS_FILE, 'utf8');
    regUsers = JSON.parse(data);
} catch (error) {
    console.log('No existing regUsers.json, starting fresh');
}

// Load waiting users from file
let waitingUsers = {};
try {
    const data = fs.readFileSync(WAIT_USERS_FILE, 'utf8');
    waitingUsers = JSON.parse(data);
    console.log('Loaded waiting users:', waitingUsers);
} catch (error) {
    console.log('No existing regwaitUsers.json, creating fresh file');
    // Initialize empty file
    fs.writeFileSync(WAIT_USERS_FILE, JSON.stringify({}, null, 2));
}

// Force HTTPS (only in production)
if (PORT !== 3000) {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] === 'https') {
      next();
    } else {
      res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
  });
}

// Add CORS middleware for Express routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Be more specific in production
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Fetch token metadata
async function fetchTokenMetadata(contractAddress) {
  try {
    const API_URL = `https://frontend-api-v2.pump.fun/coins/${contractAddress}`;
    const response = await axios.get(API_URL);
    const token = response.data;

    const numCap = Math.round(token.usd_market_cap); // Rounded market cap
    const mc = numCap.toLocaleString(); // Formatted market cap

    return { mc, numCap };
  } catch (error) {
    console.error('Error fetching metadata:', error.message);
    return null;
  }
}

// Monitor market cap
async function monitorMarketCap() {
  try {
    const tokenData = await fetchTokenMetadata(CONTRACT_ADDRESS);
    if (tokenData) {
      const { numCap, mc } = tokenData;

      // Calculate net change
      netChange = lastCap ? numCap - lastCap : 0;
      lastCap = numCap;

      console.log(`Net Change: ${netChange}`);
      console.log(`Emitting: numCap=${numCap}, mc=${mc}, netChange=${netChange}`);

      io.emit('marketCapUpdate', { mc, netChange, numCap });
    }
  } catch (error) {
    console.error('Error in monitorMarketCap:', error.message);
  }
}

// Serve static files
app.use(express.static('public'));

// Add this with your other Express routes
app.use(express.json());

app.post('/getWalletAddress', (req, res) => {
    const { username } = req.body;
    console.log('Looking up wallet for username:', username);
    
    if (regUsers[username]) {
        console.log('Found wallet:', regUsers[username].wallet);
        res.json({ wallet: regUsers[username].wallet });
    } else {
        console.log('Username not found:', username);
        res.status(404).json({ error: 'User not found' });
    }
});

// Add new endpoint for token metadata
app.get('/tokenMetadata/:contractAddress', async (req, res) => {
    try {
        const { contractAddress } = req.params;
        const API_URL = `https://frontend-api-v2.pump.fun/coins/${contractAddress}`;
        const response = await axios.get(API_URL);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching token metadata:', error);
        res.status(500).json({ error: 'Failed to fetch token metadata' });
    }
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Closed out remaining connections.');
    process.exit(0);
  });
});

// Add at the top with other constants
const tokenChatRooms = new Map(); // Store chat history for each token

// Socket connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });

    socket.on('checkGroup', (groupName, callback) => {
        const exists = groups.hasOwnProperty(groupName);
        callback(exists);
    });

    socket.on('getGroupDetails', (groupName, callback) => {
        if (groups.hasOwnProperty(groupName)) {
            callback(groups[groupName]);
        } else {
            callback(null);
        }
    });

    socket.on('joinGroup', ({ groupName, walletAddress }, callback) => {
        if (groups.hasOwnProperty(groupName)) {
            // Check if wallet is not already in the group
            if (!groups[groupName].members.includes(walletAddress)) {
                groups[groupName].members.push(walletAddress);
                console.log(`Wallet ${walletAddress} joined group ${groupName}`);
            }
            callback({ success: true, groupDetails: groups[groupName] });
        } else {
            callback({ success: false, message: 'Group not found' });
        }
    });

    socket.on('checkUsername', (username, callback) => {
        console.log('Checking username:', username);
        const exists = regUsers.hasOwnProperty(username);
        console.log('Username exists:', exists);
        callback(exists);
    });

    socket.on('checkWallet', (walletAddress, callback) => {
        console.log('Checking wallet:', walletAddress);
        // Check if wallet exists in any user entry
        const walletExists = Object.values(regUsers).some(user => user.wallet === walletAddress);
        console.log('Wallet exists:', walletExists);
        callback(walletExists);
    });

    socket.on('registerUser', (userData) => {
        try {
            // Check if wallet is already registered
            const walletExists = Object.values(regUsers).some(user => user.wallet === userData.wallet);
            if (walletExists) {
                console.log(`Wallet ${userData.wallet} already registered`);
                return;
            }

            // Add or update user data
            regUsers[userData.username] = {
                wallet: userData.wallet,
                balance: userData.balance,
                password: userData.password
            };

            // Save to file
            fs.writeFileSync('regUsers.json', JSON.stringify(regUsers, null, 2));
            console.log(`User registered: ${userData.username}`);
        } catch (error) {
            console.error('Error registering user:', error);
        }
    });

    socket.on('verifyLogin', ({ username, password }, callback) => {
        console.log('Verifying login for:', username);
        
        if (regUsers[username] && regUsers[username].password === password) {
            console.log('Login successful for:', username);
            callback({ success: true });
        } else {
            console.log('Login failed for:', username);
            callback({ success: false });
        }
    });

    socket.on('saveWaitingUser', (userData) => {
        try {
            console.log('Received waiting user data:', userData);
            
            waitingUsers[userData.username] = {
                password: userData.password,
                publicWallet: userData.publicWallet,
                verificationWallet: userData.verificationWallet
            };
            
            console.log('Updated waiting users object:', waitingUsers);
            
            fs.writeFileSync(WAIT_USERS_FILE, JSON.stringify(waitingUsers, null, 2));
            console.log(`Waiting user saved to ${WAIT_USERS_FILE}`);
            
            // Verify file was written
            const fileContent = fs.readFileSync(WAIT_USERS_FILE, 'utf8');
            console.log('File content after save:', fileContent);
        } catch (error) {
            console.error('Error saving waiting user:', error);
            console.error('Error details:', error.message);
            if (error.code) console.error('Error code:', error.code);
        }
    });

    socket.on('joinTokenChat', (contractAddress) => {
        socket.join(contractAddress);
        console.log(`User joined chat room for token: ${contractAddress}`);
        
        // Send chat history if it exists
        const chatHistory = tokenChatRooms.get(contractAddress) || [];
        socket.emit('chatHistory', chatHistory);
    });

    socket.on('leaveTokenChat', (contractAddress) => {
        socket.leave(contractAddress);
        console.log(`User left chat room for token: ${contractAddress}`);
    });

    socket.on('chatMessage', ({ contractAddress, username, message, balance }) => {
        console.log('Received chat message:', {
            contractAddress,
            username,
            message,
            balance
        });
        
        const timestamp = new Date().toISOString();
        const chatMessage = { username, message, timestamp, balance };
        console.log('Created chat message object:', chatMessage);
        
        // Store message in history
        if (!tokenChatRooms.has(contractAddress)) {
            tokenChatRooms.set(contractAddress, []);
            console.log('Created new chat room for contract:', contractAddress);
        }
        const chatHistory = tokenChatRooms.get(contractAddress);
        chatHistory.push(chatMessage);
        console.log('Updated chat history. New length:', chatHistory.length);
        
        // Limit history to last 100 messages
        if (chatHistory.length > 100) {
            chatHistory.shift();
            console.log('Trimmed chat history to 100 messages');
        }
        
        // Broadcast message to room
        console.log('Broadcasting message to room:', contractAddress);
        io.to(contractAddress).emit('newMessage', chatMessage);
    });
});
