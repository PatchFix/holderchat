const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const socket = io(); // Initialize Socket.IO client

let width, height;
let publicKey = null;
let wallet = null;

let displayText = 'HELLO';

// Set up canvas size
function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  
  // Reset canvas context properties after resize
  ctx.fillStyle = '#001f00';
  ctx.font = '48px "Courier New", Courier, monospace';
  ctx.textAlign = 'center';
  
  // Trigger an immediate redraw after resize
  draw();
}


resizeCanvas();
window.addEventListener('resize', resizeCanvas);
     
// Update createConnectButton function
function createConnectButton() {
    buttonContainer = document.createElement('div');
    buttonContainer.id = 'auth-buttons';
    buttonContainer.style.cssText = `
        position: fixed;
        top: 30%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 15px;
        z-index: 998;
    `;

    const signUpButton = document.createElement('button');
    signUpButton.style.cssText = `
        padding: 15px 30px;
        font-size: 18px;
        background: #4e44ce;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: system-ui, -apple-system, sans-serif;
        transition: background 0.2s;
        width: 200px;
    `;
    signUpButton.textContent = 'Sign Up';

    const loginButton = document.createElement('button');
    loginButton.style.cssText = signUpButton.style.cssText;
    loginButton.style.background = '#2e8b57';
    loginButton.textContent = 'Log In';

    signUpButton.addEventListener('mouseenter', () => {
        signUpButton.style.background = '#3d35a1';
    });

    signUpButton.addEventListener('mouseleave', () => {
        signUpButton.style.background = '#4e44ce';
    });

    loginButton.addEventListener('mouseenter', () => {
        loginButton.style.background = '#236b43';
    });

    loginButton.addEventListener('mouseleave', () => {
        loginButton.style.background = '#2e8b57';
    });

    signUpButton.onclick = createWalletOverlay;
    loginButton.onclick = createLoginOverlay;

    buttonContainer.appendChild(signUpButton);
    buttonContainer.appendChild(loginButton);
    document.body.appendChild(buttonContainer);
}

// Update createHolderBoardInput function
function createHolderBoardInput() {
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 15px;
        z-index: 998;
    `;
    
    const input = document.createElement('input');
    input.placeholder = 'Enter Contract Address';
    input.style.cssText = `
        padding: 12px;
        width: 300px;
        border: 2px solid #4e44ce;
        border-radius: 4px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 16px;
        background: rgba(0, 31, 0, 0.7);
        color: #00ff00;
        text-align: center;
    `;
    
    const button = document.createElement('button');
    button.textContent = 'Join Holder Board';
    button.style.cssText = `
        padding: 12px 24px;
        background: #4e44ce;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 16px;
        transition: background 0.2s;
    `;
    
    button.addEventListener('mouseenter', () => {
        button.style.background = '#3d35a1';
    });
    
    button.addEventListener('mouseleave', () => {
        button.style.background = '#4e44ce';
    });
    
    const resetView = () => {
        input.style.display = 'block';
        container.style.display = 'flex';
        input.value = '';
    };
    
    button.addEventListener('click', async () => {
        // Check if user is logged in
        if (!displayText.startsWith('HELLO, ')) {
            showNotification('Please log in first');
            return;
        }

        const username = displayText.slice(7, -1);
        
        try {
            // Get user's wallet address
            const response = await fetch('/getWalletAddress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username })
            });
            
            const data = await response.json();
            if (!data.wallet) {
                showNotification('Error retrieving wallet information');
                return;
            }

            // Check HCB balance using Solana Web3
            const HCB_CONTRACT = 'HUVPbbr9QaDCJ9BQGcP94nzckm4nVYeDpwhWLcb5pump';
            try {
                console.log('Checking HCB balance for wallet:', data.wallet);
                const connection = new solanaWeb3.Connection('https://mainnet.helius-rpc.com/?api-key=9de0b45d-2c02-471d-91a0-808da4274b97');
                
                const tokenMint = new solanaWeb3.PublicKey(HCB_CONTRACT);
                const publicAccounts = await connection.getParsedTokenAccountsByOwner(
                    new solanaWeb3.PublicKey(data.wallet),
                    { mint: tokenMint }
                );
                
                let balance = 0;
                if (publicAccounts.value.length > 0) {
                    balance = publicAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
                }
                
                console.log('Retrieved HCB balance:', balance);

                if (balance < 50000) {
                    showNotification('You need at least 50,000 $HCB to access holder boards');
                    return;
                }

                // If we get here, user has enough HCB - proceed with joining board
                const contractAddress = input.value.trim();
                if (contractAddress) {
                    try {
                        const API_URL = `https://frontend-api-v2.pump.fun/coins/${contractAddress}`;
                        const response = await axios.get(API_URL);
                        const token = response.data;
                        
                        // Hide input container
                        container.style.display = 'none';
                        
                        // Create chat interface with token data
                        if (chatCleanup) {
                            chatCleanup();
                        }
                        chatCleanup = createChatInterface(contractAddress, token, resetView);
                        
                        console.log('Token Info:', token);
                    } catch (error) {
                        console.error('Error fetching token info:', error);
                        showNotification('Error fetching token information. Please check the contract address.');
                    }
                } else {
                    showNotification('Please enter a contract address');
                }
            } catch (error) {
                console.error('Error checking HCB balance:', error);
                showNotification('Error checking HCB balance');
            }
        } catch (error) {
            console.error('Error retrieving wallet information:', error);
            showNotification('Error retrieving wallet information');
        }
    });
    
    container.appendChild(input);
    container.appendChild(button);
    document.body.appendChild(container);
}

// Update window load event listener
window.addEventListener('load', () => {
    createConnectButton();
    createHolderBoardInput();
});

// Create wallet connection overlay
function createWalletOverlay() {
    // Create background overlay
    const backgroundOverlay = document.createElement('div');
    backgroundOverlay.id = 'wallet-background-overlay';
    backgroundOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
    `;

    const overlay = document.createElement('div');
    overlay.id = 'wallet-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #9cc1cb;
        border: 2px solid #612d70;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;

    const title = document.createElement('h2');
    title.textContent = 'Connect Wallet';
    title.style.color = '#1a1a1a';
    title.style.cssText = `
        color: #1a1a1a;
        margin: 0 0 10px 0;
    `;
    overlay.appendChild(title);

    const baseButtonStyle = `
        display: block;
        width: 200px;
        margin: 10px auto;
        padding: 10px;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: system-ui, -apple-system, sans-serif;
        transition: background 0.2s;
    `;

    // Phantom connection button
    const phantomBtn = document.createElement('button');
    phantomBtn.textContent = 'Connect Phantom';
    phantomBtn.style.cssText = baseButtonStyle + 'background: #4e44ce;';
    phantomBtn.onclick = async () => await connectWallet('phantom');
    overlay.appendChild(phantomBtn);

    // Solflare connection button
    const solflareBtn = document.createElement('button');
    solflareBtn.textContent = 'Connect Solflare';
    solflareBtn.style.cssText = baseButtonStyle + 'background: #ac5d28;';
    solflareBtn.onclick = async () => await connectWallet('solflare');
    overlay.appendChild(solflareBtn);

    // Add header text
    const header = document.createElement('div');
    header.style.cssText = `
        text-align: center;
        margin-top: 10px;
        color: #1a1a1a;
    `;
      
    const subheaderText = document.createElement('p');
    subheaderText.textContent = '(No Connection Required)';
    subheaderText.style.cssText = `
        margin: 5px 0;
        font-size: 12px;
        opacity: 0.8;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    
    header.appendChild(subheaderText);
    overlay.appendChild(header);

    // Add Telegram buttons
    const verifyTgBtn = document.createElement('button');
    verifyTgBtn.textContent = 'Manual Link';
    verifyTgBtn.style.cssText = baseButtonStyle + 'background: #1a4b8c;';
    verifyTgBtn.onclick = () => createVerificationOverlay();
    overlay.appendChild(verifyTgBtn);

    // Add username input field
    const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.placeholder = 'Username';
    usernameInput.maxLength = 16;
    usernameInput.style.cssText = `
        display: block;
        width: 180px;
        margin: 35px auto 10px auto;
        padding: 8px;
        border: 1px solid #612d70;
        border-radius: 4px;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    // Restrict to letters and numbers only
    usernameInput.addEventListener('input', (e) => {
        const value = e.target.value;
        const invalidChars = value.match(/[^A-Za-z0-9]/g);
        if (invalidChars) {
            showNotification('Username can only contain letters and numbers');
            e.target.value = value.replace(/[^A-Za-z0-9]/g, '');
        }
    });
    overlay.appendChild(usernameInput);

    // Add password input field
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.placeholder = 'Password';
    passwordInput.maxLength = 32;
    passwordInput.style.cssText = `
        display: block;
        width: 180px;
        margin: 10px auto 10px auto;
        padding: 8px;
        border: 1px solid #612d70;
        border-radius: 4px;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    overlay.appendChild(passwordInput);

    const loginTgBtn = document.createElement('button');
    loginTgBtn.textContent = 'Login';
    loginTgBtn.style.cssText = baseButtonStyle + 'background: #17212B;';
    loginTgBtn.onclick = async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        if (!username || !password) {
            showNotification('Please fill in all fields');
            return;
        }

        // Verify login credentials
        socket.emit('verifyLogin', { username, password }, (response) => {
            if (response.success) {
                displayText = `HELLO, ${username}!`;
                backgroundOverlay.remove();
                overlay.remove();
                
                // Remove auth buttons after successful login
                if (buttonContainer) {
                    buttonContainer.remove();
                }
                showNotification('Successfully logged in', 'success');
            } else {
                showNotification('Invalid username or password');
            }
        });
    };
    overlay.appendChild(loginTgBtn);

    // Add click handler for background overlay
    const closeOverlay = () => {
        const bgOverlay = document.getElementById('wallet-background-overlay');
        const walletOverlay = document.getElementById('wallet-overlay');
        if (bgOverlay) bgOverlay.remove();
        if (walletOverlay) walletOverlay.remove();
    };
    
    backgroundOverlay.addEventListener('click', closeOverlay);

    // Prevent clicks on the modal from closing it
    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    document.body.appendChild(backgroundOverlay);
    document.body.appendChild(overlay);
}

// Add minBalance constant
const minBalance = 10000; // Default minimum balance requirement

// Update checkTokenBalance function to use Solana Web3
async function checkTokenBalance(contractAddress, walletAddress) {
    try {
        console.log(`Checking balance for wallet ${walletAddress} on contract ${contractAddress}`);
        
        // Create connection
        const connection = new solanaWeb3.Connection('https://mainnet.helius-rpc.com/?api-key=9de0b45d-2c02-471d-91a0-808da4274b97');
        
        // Get balance of specific token from public wallet
        const tokenMint = new solanaWeb3.PublicKey(contractAddress);
        const publicAccounts = await connection.getParsedTokenAccountsByOwner(
            new solanaWeb3.PublicKey(walletAddress),
            { mint: tokenMint }
        );
        
        let balance = 0;
        if (publicAccounts.value.length > 0) {
            balance = publicAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        }
        
        console.log('Retrieved balance:', balance);
        return balance;
    } catch (error) {
        console.error('Error checking token balance:', error);
        return 0;
    }
}

// Add socket connection handling at the top of your file
socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
});

socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
});

// Update promptUsername function
async function promptUsername() {
    return new Promise((resolve) => {
        const usernamePrompt = document.createElement('div');
        usernamePrompt.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #9cc1cb;
            border: 2px solid #612d70;
            border-radius: 8px;
            padding: 30px 20px 20px 20px;  /* Increased top padding */
            text-align: center;
            z-index: 1001;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            width: auto;
            min-width: 200px;
        `;

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 8px;  /* Adjusted from 10px */
            right: 8px;  /* Adjusted from 10px */
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #612d70;
            padding: 0;
            width: 24px;
            height: 24px;
            line-height: 24px;
            text-align: center;
            border-radius: 12px;
            transition: background-color 0.2s;
        `;
        
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.backgroundColor = 'rgba(97, 45, 112, 0.1)';
        });
        
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.backgroundColor = 'transparent';
        });
        
        closeBtn.onclick = () => {
            usernamePrompt.remove();
            resolve(null);  // Resolve with null to indicate cancellation
        };

        usernamePrompt.appendChild(closeBtn);

        // Rest of existing prompt code...
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter username';
        input.maxLength = 16;
        input.style.cssText = `
            display: block;
            width: 180px;
            margin: 10px auto;
            padding: 8px;
            border: 1px solid #612d70;
            border-radius: 4px;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        
        // Restrict to letters and numbers only
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, '');
        });

        const submitBtn = document.createElement('button');
        submitBtn.textContent = 'Continue';
        submitBtn.style.cssText = `
            display: block;
            width: 100px;
            margin: 10px auto;
            padding: 8px;
            background: #4e44ce;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: system-ui, -apple-system, sans-serif;
        `;

        submitBtn.onclick = () => {
            console.log('Submit clicked');
            const username = input.value.trim();
            
            if (username) {
                if (!socket.connected) {
                    console.error('Socket not connected!');
                    showNotification('Connection to server lost. Please refresh the page.');
                    return;
                }

                console.log('Checking username:', username);
                console.log('Socket ID:', socket.id);
                console.log('Socket connected:', socket.connected);
                
                socket.emit('checkUsername', username, (exists) => {
                    console.log('Server response:', exists);
                    if (exists) {
                        showNotification('Username already taken. Please choose another.');
                    } else {
                        usernamePrompt.remove();
                        resolve(username);
                    }
                });
            } else {
                showNotification('Please enter a username');
            }
        };

        usernamePrompt.appendChild(input);
        usernamePrompt.appendChild(submitBtn);
        document.body.appendChild(usernamePrompt);
        setTimeout(() => input.focus(), 0);
    });
}

// Add password prompt function
async function promptPassword() {
    return new Promise((resolve) => {
        const passwordPrompt = document.createElement('div');
        passwordPrompt.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #9cc1cb;
            border: 2px solid #612d70;
            border-radius: 8px;
            padding: 30px 20px 20px 20px;
            text-align: center;
            z-index: 1001;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            width: auto;
            min-width: 200px;
        `;

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #612d70;
            padding: 0;
            width: 24px;
            height: 24px;
            line-height: 24px;
            text-align: center;
            border-radius: 12px;
            transition: background-color 0.2s;
        `;
        
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.backgroundColor = 'rgba(97, 45, 112, 0.1)';
        });
        
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.backgroundColor = 'transparent';
        });
        
        closeBtn.onclick = () => {
            passwordPrompt.remove();
            resolve(null);
        };

        const input = document.createElement('input');
        input.type = 'password';
        input.placeholder = 'Enter password (min 8 characters)';
        input.style.cssText = `
            display: block;
            width: 180px;
            margin: 10px auto;
            padding: 8px;
            border: 1px solid #612d70;
            border-radius: 4px;
            font-family: system-ui, -apple-system, sans-serif;
        `;

        const submitBtn = document.createElement('button');
        submitBtn.textContent = 'Continue';
        submitBtn.style.cssText = `
            display: block;
            width: 100px;
            margin: 10px auto;
            padding: 8px;
            background: #4e44ce;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: system-ui, -apple-system, sans-serif;
        `;

        submitBtn.onclick = () => {
            const password = input.value;
            if (password.length >= 8) {
                passwordPrompt.remove();
                resolve(password);
            } else {
                showNotification('Password must be at least 8 characters long');
            }
        };

        passwordPrompt.appendChild(closeBtn);
        passwordPrompt.appendChild(input);
        passwordPrompt.appendChild(submitBtn);
        document.body.appendChild(passwordPrompt);
        setTimeout(() => input.focus(), 0);
    });
}

// Update connectWallet function
async function connectWallet(walletName) {
    try {
        // Get username first
        const username = await promptUsername();
        if (!username) return;  // Username was null or empty, or prompt was closed

        let walletAdapter;
        if (walletName === 'phantom') {
            walletAdapter = window.solana;
            if (!walletAdapter?.isPhantom) {
                showNotification('Please install Phantom wallet');
                return;
            }
        } else if (walletName === 'solflare') {
            walletAdapter = window.solflare;
            if (!walletAdapter) {
                showNotification('Please install Solflare wallet');
                return;
            }
        }

        await walletAdapter.connect();
        wallet = walletAdapter;
        publicKey = wallet.publicKey.toString();
        
        // Check if wallet is already registered
        socket.emit('checkWallet', publicKey, (exists) => {
            if (exists) {
                showNotification('This wallet is already linked to a username. Please use a different wallet.');
                return;
            }
            
            // Continue with registration if wallet is not registered
            continueRegistration(username, publicKey, walletAdapter);
        });
        
    } catch (err) {
        console.error('Wallet connection error:', err);
        showNotification('Failed to connect wallet');
    }
}

// Update continueRegistration function
async function continueRegistration(username, publicKey, walletAdapter) {
    try {
        // Check HCB balance
        const HCB_CONTRACT = 'HUVPbbr9QaDCJ9BQGcP94nzckm4nVYeDpwhWLcb5pump';
        console.log('Checking HCB balance for wallet:', publicKey);
        const connection = new solanaWeb3.Connection('https://mainnet.helius-rpc.com/?api-key=9de0b45d-2c02-471d-91a0-808da4274b97');
        
        const tokenMint = new solanaWeb3.PublicKey(HCB_CONTRACT);
        const publicAccounts = await connection.getParsedTokenAccountsByOwner(
            new solanaWeb3.PublicKey(publicKey),
            { mint: tokenMint }
        );
        
        let balance = 0;
        if (publicAccounts.value.length > 0) {
            balance = publicAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        }
        
        console.log('Retrieved HCB balance:', balance);
        
        // Prompt for password
        const password = await promptPassword();
        if (!password) return; // User cancelled password entry
        
        // Save user data to regUsers.json
        socket.emit('registerUser', {
            username: username,
            wallet: publicKey,
            balance: balance,
            password: password
        }, (response) => {
            if (response.success) {
                displayText = `HELLO, ${username}!`;
                if (backgroundOverlay) backgroundOverlay.remove();
                if (overlay) overlay.remove();
                
                // Remove auth buttons after successful registration
                if (buttonContainer) {
                    buttonContainer.remove();
                }
                showNotification('Successfully registered', 'success');
            }
        });
        
        console.log('Connected wallet:', publicKey);
    } catch (err) {
        console.error('Registration error:', err);
        showNotification('Failed to complete registration');
    }
}

// Add userLogin function
async function userLogin(userName) {
    // Get first 5 characters of wallet address
    displayText = `HELLO, ${userName}!`;
    console.log('User logged in:', userName);
}

// Update draw function to use displayText
function draw() {
    // Clear the canvas
    ctx.fillStyle = '#001f00'; // Dark gray/green background
    ctx.fillRect(0, 0, width, height);
    
    // Draw the text at the top center
    ctx.save();
    ctx.font = '48px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ff00';
    ctx.fillText(displayText, width / 2, 60);
    ctx.restore();

    // Request the next frame
    requestAnimationFrame(draw);
}

// Start the animation loop
draw();

// Add function to show group prompt
function showGroupPrompt() {
    // Check if wallet is connected first
    if (!publicKey) {
        alert('Please connect your wallet first');
        return;
    }

    const { overlay, backgroundOverlay, closeOverlay } = createOverlay();
    
    const title = document.createElement('h2');
    title.textContent = 'Enter Group Name';
    title.style.color = '#1a1a1a';
    overlay.appendChild(title);
    
    const input = document.createElement('input');
    input.type = 'text';
    input.pattern = '[A-Za-z0-9]+';
    input.style.cssText = `
        display: block;
        width: 200px;
        margin: 20px auto;
        padding: 10px;
        border: 2px solid #612d70;
        border-radius: 4px;
        font-size: 16px;
    `;
    
    input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, '');
    });
    
    overlay.appendChild(input);
    setTimeout(() => input.focus(), 0);
    
    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Join Group';
    submitBtn.style.cssText = `
        display: block;
        width: 200px;
        margin: 10px auto;
        padding: 10px;
        background: #2e8b57;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
    
    submitBtn.onclick = () => {
        console.log('Submit button clicked');
        const groupValue = input.value.trim();
        console.log('Input value:', groupValue);
        
        if (groupValue) {
            console.log('Socket object exists:', !!socket);
            console.log('Socket connected:', socket.connected);
            
            try {
                socket.emit('checkGroup', groupValue, (exists) => {
                    console.log('Callback received with exists:', exists);
                    if (exists) {
                        // Join group with wallet address
                        socket.emit('joinGroup', {
                            groupName: groupValue,
                            walletAddress: publicKey
                        }, (response) => {
                            if (response.success) {
                                currentGroup = {
                                    name: groupValue,
                                    ...response.groupDetails
                                };
                                
                                const groupBtn = document.querySelector('.group-button');
                                if (groupBtn) {
                                    groupBtn.textContent = `${groupValue} (${response.groupDetails.members.length})`;
                                    console.log('Button text updated to:', groupBtn.textContent);
                                } else {
                                    console.error('Group button not found in DOM');
                                }
                                closeOverlay();
                            } else {
                                console.log('Failed to join group:', response.message);
                                alert(response.message || 'Failed to join group');
                            }
                        });
                    } else {
                        console.log('Group not found in server response');
                        alert('Group not found!');
                    }
                });
                console.log('Socket.emit completed');
            } catch (error) {
                console.error('Error in socket emission:', error);
            }
        } else {
            console.log('No group value entered');
            alert('Please enter a group name');
        }
    };
    
    overlay.appendChild(submitBtn);
}

// Helper function to create overlay
function createOverlay() {
    const backgroundOverlay = document.createElement('div');
    backgroundOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
    `;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #9cc1cb;
        border: 2px solid #612d70;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    
    const closeOverlay = () => {
        backgroundOverlay.remove();
        overlay.remove();
    };
    
    backgroundOverlay.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => e.stopPropagation());
    
    document.body.appendChild(backgroundOverlay);
    document.body.appendChild(overlay);
    
    return { overlay, backgroundOverlay, closeOverlay };
}

// Create columns and cards container
// function createColumnsContainer() {
//     const columnsContainer = document.createElement('div');
//     columnsContainer.id = 'columns-container';
//     columnsContainer.style.cssText = `
//         position: fixed;
//         top: 0;
//         left: 0;
//         right: 0;
//         bottom: 0;
//         display: flex;
//         justify-content: space-between;
//         padding: 15px;
//         margin-top: 80px;
//         height: calc(100vh - 95px);
//         gap: 15px;
//         pointer-events: none;
//         z-index: 1;
//     `;

//     // Create three columns
//     for (let i = 0; i < 3; i++) {
//         const column = document.createElement('div');
//         column.className = 'column';
//         column.style.cssText = `
//             flex: 1;
//             background: rgba(0, 50, 0, 0.3);
//             border-radius: 8px;
//             padding: 12px;
//             overflow-y: auto;
//             display: flex;
//             flex-direction: column;
//             gap: 12px;
//             pointer-events: auto;
//         `;

//         // Update the card creation part
//         for (let j = 0; j < 3; j++) {
//             const card = document.createElement('div');
//             card.className = 'card';
//             card.style.cssText = `
//                 background: rgba(26, 26, 26, 0.95);
//                 border: 1px solid rgba(0, 255, 0, 0.2);
//                 border-radius: 12px;
//                 padding: 15px;
//                 color: #ffffff;
//                 display: flex;
//                 gap: 15px;
//                 align-items: center;
//                 backdrop-filter: blur(10px);
//                 box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
//                 transition: transform 0.2s, border-color 0.2s;
//                 cursor: pointer;
//             `;

//             card.addEventListener('mouseenter', () => {
//                 card.style.transform = 'translateY(-2px)';
//                 card.style.borderColor = 'rgba(0, 255, 0, 0.4)';
//             });

//             card.addEventListener('mouseleave', () => {
//                 card.style.transform = 'translateY(0)';
//                 card.style.borderColor = 'rgba(0, 255, 0, 0.2)';
//             });

//             // Left side content container
//             const contentContainer = document.createElement('div');
//             contentContainer.style.cssText = `
//                 flex: 1;
//                 display: flex;
//                 flex-direction: column;
//                 gap: 12px;
//             `;

//             // Token info container
//             const infoContainer = document.createElement('div');
//             infoContainer.style.cssText = `
//                 display: flex;
//                 flex-direction: column;
//                 gap: 8px;
//                 font-family: system-ui, -apple-system, sans-serif;
//             `;

//             // Token name and symbol
//             const nameSymbol = document.createElement('div');
//             nameSymbol.style.cssText = `
//                 font-size: 18px;
//                 font-weight: 600;
//                 color: #ffffff;
//                 letter-spacing: -0.01em;
//             `;
//             nameSymbol.textContent = 'Token Name ($TKN)';

//             // Called By information
//             const calledBy = document.createElement('div');
//             calledBy.style.cssText = `
//                 font-size: 14px;
//                 color: rgba(255, 255, 255, 0.8);
//             `;
//             calledBy.textContent = 'Called By: UserName';

//             // Called Time information
//             const calledTime = document.createElement('div');
//             calledTime.style.cssText = `
//                 font-size: 14px;
//                 color: rgba(255, 255, 255, 0.8);
//             `;
//             calledTime.textContent = 'Called: 1 hour, 15 minutes';

//             // Price information
//             const priceInfo = document.createElement('div');
//             priceInfo.style.cssText = `
//                 display: flex;
//                 flex-direction: column;
//                 gap: 6px;
//                 font-size: 14px;
//                 color: rgba(255, 255, 255, 0.8);
//                 margin-top: 8px;
//             `;

//             let callNum = 64800;
//             let currNum = 142000;
//             let xNum = Number((currNum/callNum).toFixed(2));
            
//             const callPrice = document.createElement('div');
//             callPrice.textContent = `Call: $${callNum.toLocaleString()}`;
            
//             const currentPrice = document.createElement('div');
//             currentPrice.textContent = `Now: $${currNum.toLocaleString()}`;

//             const multiplier = document.createElement('div');
//             multiplier.textContent = `${xNum}x`;
//             multiplier.style.cssText = `
//                 color: #4ade80;
//                 font-weight: 600;
//                 font-size: 16px;
//             `;

//             priceInfo.appendChild(callPrice);
//             priceInfo.appendChild(currentPrice);
//             priceInfo.appendChild(multiplier);

//             infoContainer.appendChild(nameSymbol);
//             infoContainer.appendChild(calledBy);
//             infoContainer.appendChild(calledTime);
//             infoContainer.appendChild(priceInfo);

//             // Right side container for image and links
//             const rightContainer = document.createElement('div');
//             rightContainer.style.cssText = `
//                 display: flex;
//                 flex-direction: column;
//                 gap: 12px;
//                 align-items: center;
//                 flex-shrink: 0;
//             `;

//             // Image container
//             const imageContainer = document.createElement('div');
//             imageContainer.style.cssText = `
//                 width: 80px;
//                 height: 80px;
//                 flex-shrink: 0;
//                 border-radius: 50%;
//                 overflow: hidden;
//                 border: 2px solid rgba(74, 222, 128, 0.3);
//                 box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
//             `;

//             const image = document.createElement('img');
//             image.src = 'https://via.placeholder.com/150';
//             image.style.cssText = `
//                 width: 100%;
//                 height: 100%;
//                 object-fit: cover;
//             `;
//             imageContainer.appendChild(image);

//             // Social links container (vertical under image)
//             const socialLinksContainer = document.createElement('div');
//             socialLinksContainer.style.cssText = `
//                 display: flex;
//                 gap: 8px;
//                 flex-wrap: wrap;
//                 justify-content: center;
//             `;

//             // Add social links
//             ['X', 'TG', 'DC', 'WP'].forEach(link => {
//                 const linkBtn = document.createElement('a');
//                 linkBtn.href = '#';
//                 linkBtn.textContent = link;
//                 linkBtn.style.cssText = `
//                     color: #4ade80;
//                     text-decoration: none;
//                     background: rgba(74, 222, 128, 0.1);
//                     padding: 4px 8px;
//                     border-radius: 6px;
//                     font-size: 12px;
//                     font-weight: 500;
//                     font-family: system-ui, -apple-system, sans-serif;
//                     transition: all 0.2s;
//                 `;

//                 linkBtn.addEventListener('mouseenter', () => {
//                     linkBtn.style.background = 'rgba(74, 222, 128, 0.2)';
//                 });

//                 linkBtn.addEventListener('mouseleave', () => {
//                     linkBtn.style.background = 'rgba(74, 222, 128, 0.1)';
//                 });

//                 socialLinksContainer.appendChild(linkBtn);
//             });

//             // Resource links container (horizontal below social links)
//             const resourceLinksContainer = document.createElement('div');
//             resourceLinksContainer.style.cssText = `
//                 display: flex;
//                 gap: 8px;
//                 flex-wrap: wrap;
//                 justify-content: center;
//                 margin-top: 8px;
//                 width: 100%;
//             `;

//             // Add resource links horizontally
//             ['B', 'C', 'D', 'E'].forEach(link => {
//                 const linkBtn = document.createElement('a');
//                 linkBtn.href = '#';
//                 linkBtn.textContent = link;
//                 linkBtn.style.cssText = `
//                     color: #4ade80;
//                     text-decoration: none;
//                     background: rgba(74, 222, 128, 0.1);
//                     padding: 4px 8px;
//                     border-radius: 6px;
//                     font-size: 12px;
//                     font-weight: 500;
//                     font-family: system-ui, -apple-system, sans-serif;
//                     transition: all 0.2s;
//                 `;

//                 linkBtn.addEventListener('mouseenter', () => {
//                     linkBtn.style.background = 'rgba(74, 222, 128, 0.2)';
//                 });

//                 linkBtn.addEventListener('mouseleave', () => {
//                     linkBtn.style.background = 'rgba(74, 222, 128, 0.1)';
//                 });

//                 resourceLinksContainer.appendChild(linkBtn);
//             });

//             rightContainer.appendChild(imageContainer);
//             rightContainer.appendChild(socialLinksContainer);
//             rightContainer.appendChild(resourceLinksContainer);
            
//             contentContainer.appendChild(infoContainer);
//             card.appendChild(contentContainer);
//             card.appendChild(rightContainer);
            
//             column.appendChild(card);
//         }

//         columnsContainer.appendChild(column);
//     }

//     document.body.appendChild(columnsContainer);
// }

async function createVerificationOverlay() {
    const backgroundOverlay = document.createElement('div');
    backgroundOverlay.id = 'verification-background-overlay';
    backgroundOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
    `;

    const overlay = document.createElement('div');
    overlay.id = 'verification-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #9cc1cb;
        border: 2px solid #612d70;
        border-radius: 8px;
        padding: 30px 20px;
        text-align: center;
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        width: auto;
        min-width: 300px;
    `;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #612d70;
        padding: 0;
        width: 24px;
        height: 24px;
        line-height: 24px;
        text-align: center;
        border-radius: 12px;
        transition: background-color 0.2s;
    `;
    
    closeBtn.onclick = () => {
        backgroundOverlay.remove();
        overlay.remove();
    };

    // Input fields
    const inputStyle = `
        display: block;
        width: 250px;
        margin: 10px auto;
        padding: 8px;
        border: 1px solid #612d70;
        border-radius: 4px;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.placeholder = 'Username';
    usernameInput.maxLength = 20;
    usernameInput.style.cssText = inputStyle;
    usernameInput.addEventListener('input', (e) => {
        const value = e.target.value;
        const invalidChars = value.match(/[^A-Za-z0-9]/g);
        if (invalidChars) {
            showNotification('Username can only contain letters and numbers');
            e.target.value = value.replace(/[^A-Za-z0-9]/g, '');
        }
    });

    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.placeholder = 'Password (min 8 characters)';
    passwordInput.style.cssText = inputStyle;

    const walletInput = document.createElement('input');
    walletInput.type = 'text';
    walletInput.placeholder = 'Public Wallet Address';
    walletInput.style.cssText = inputStyle;

    // Start Verification button
    const startVerifyBtn = document.createElement('button');
    startVerifyBtn.textContent = 'Start Verification';
    startVerifyBtn.style.cssText = `
        display: block;
        width: 250px;
        margin: 20px auto;
        padding: 10px;
        background: #4e44ce;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    startVerifyBtn.onclick = async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const walletAddress = walletInput.value.trim();

        if (!username || !password || !walletAddress) {
            showNotification('Please fill in all fields');
            return;
        }

        if (password.length < 8) {
            showNotification('Password must be at least 8 characters long');
            return;
        }

        if (!isValidSolanaAddress(walletAddress)) {
            showNotification('Please enter a valid Solana wallet address');
            return;
        }

        // Check if wallet is already registered
        socket.emit('checkWallet', walletAddress, async (exists) => {
            if (exists) {
                showNotification('This wallet address is already registered. Please use a different wallet.');
                return;
            }

            try {
                // Generate verification wallet
                const verificationAddress = await generateVerificationWallet();
                
                // Lock input fields
                usernameInput.disabled = true;
                passwordInput.disabled = true;
                walletInput.disabled = true;
                startVerifyBtn.disabled = true;

                // Update address display with generated address
                addressDisplay.textContent = verificationAddress;

                // Save to regwaitUsers.json
                socket.emit('saveWaitingUser', {
                    username,
                    password,
                    publicWallet: walletAddress,
                    verificationWallet: verificationAddress
                });
            } catch (error) {
                console.error('Error in verification process:', error);
                showNotification('Failed to generate verification address. Please try again.');
            }
        });
    };

    // Instructions
    const instructions = document.createElement('p');
    instructions.innerHTML = 'Click Start Verification to generate a verification wallet address.<br><br>' +
        'Send 1 (one) of any meme token to this address.<br>' +
        'DO NOT SEND SOL TO THE VERIFICATION WALLET!<br><br>' +
        'After one token is sent to the wallet, click Verify to complete the process.';
    instructions.style.cssText = `
        margin: 20px 0;
        color: #612d70;
        font-size: 14px;
    `;

    // Verification address display
    const addressDisplay = document.createElement('div');
    addressDisplay.textContent = '<waiting for wallet...>';
    addressDisplay.style.cssText = `
        margin: 10px auto;
        padding: 10px;
        font-family: monospace;
        word-break: break-all;
        color: #17212B;
        font-size: 14px;
        max-width: 250px;
    `;

    // Copy button with verification address
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Click to Copy';
    copyBtn.style.cssText = `
        display: block;
        width: 250px;
        margin: 10px auto;
        padding: 10px;
        background: #17212B;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(addressDisplay.textContent);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = originalText, 1000);
    };

    // Verify button
    const verifyBtn = document.createElement('button');
    verifyBtn.textContent = 'Verify';
    verifyBtn.style.cssText = `
        display: block;
        width: 250px;
        margin: 20px auto 10px auto;
        padding: 10px;
        background: #2e8b57;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    // Update the verify button's onclick handler
    verifyBtn.onclick = async () => {
        try {
            const username = usernameInput.value.trim();
            const publicWallet = walletInput.value.trim();
            const password = passwordInput.value;
            const verificationAddress = addressDisplay.textContent;

            // Create connection
            const connection = new solanaWeb3.Connection('https://mainnet.helius-rpc.com/?api-key=9de0b45d-2c02-471d-91a0-808da4274b97');

            // Get all token accounts for verification wallet
            const verificationAccounts = await connection.getParsedTokenAccountsByOwner(
                new solanaWeb3.PublicKey(verificationAddress),
                { programId: new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
            );

            let isVerified = false;
            
            // Check each token account for any token transfer from public wallet
            for (const account of verificationAccounts.value) {
                const tokenData = account.account.data.parsed.info;
                
                // Check if token was received from public wallet
                if (tokenData.tokenAmount.uiAmount > 0) {
                    // Get transaction history for this token account
                    const signatures = await connection.getSignaturesForAddress(account.pubkey);
                    
                    for (const sig of signatures) {
                        const tx = await connection.getParsedTransaction(sig.signature);
                        // Check if transaction source is the public wallet
                        if (tx.transaction.message.accountKeys.some(key => 
                            key.pubkey.toString() === publicWallet
                        )) {
                            isVerified = true;
                            break;
                        }
                    }
                    if (isVerified) break;
                }
            }

            if (isVerified) {
                // Get balance of specific token from public wallet
                const tokenMint = new solanaWeb3.PublicKey('HUVPbbr9QaDCJ9BQGcP94nzckm4nVYeDpwhWLcb5pump');
                const publicAccounts = await connection.getParsedTokenAccountsByOwner(
                    new solanaWeb3.PublicKey(publicWallet),
                    { mint: tokenMint }
                );
                
                let balance = 0;
                if (publicAccounts.value.length > 0) {
                    balance = publicAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
                }

                // Register user
                socket.emit('registerUser', {
                    username,
                    wallet: publicWallet,
                    balance,
                    password
                });

                // Close verification overlay
                backgroundOverlay.remove();
                overlay.remove();

                // Remove auth buttons
                if (buttonContainer) {
                    buttonContainer.remove();
                }

                // Set display text directly
                displayText = `HELLO, ${username}!`;

                // Remove auto-login form creation since we're already logged in
            } else {
                showNotification('Verification failed. Please ensure you have sent a token from your public wallet to the verification address.');
            }
        } catch (error) {
            console.error('Verification error:', error);
            showNotification('Error during verification. Please try again.');
        }
    };

    // Add all elements to overlay
    overlay.appendChild(closeBtn);
    overlay.appendChild(usernameInput);
    overlay.appendChild(passwordInput);
    overlay.appendChild(walletInput);
    overlay.appendChild(startVerifyBtn);
    overlay.appendChild(instructions);
    overlay.appendChild(addressDisplay);
    overlay.appendChild(copyBtn);
    overlay.appendChild(verifyBtn);

    // Add to document
    document.body.appendChild(backgroundOverlay);
    document.body.appendChild(overlay);
}

// Helper function to validate Solana address
function isValidSolanaAddress(address) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

// Add function to generate Solana wallet
async function generateVerificationWallet() {
    try {
        // Generate a new keypair using solanaWeb3
        const keypair = solanaWeb3.Keypair.generate();
        return keypair.publicKey.toString();
    } catch (error) {
        console.error('Error generating verification wallet:', error);
        throw error;
    }
}

// Add message cooldown tracking
const userLastMessage = new Map();

// Update createChatInterface function's sendMessage
function createChatInterface(contractAddress, token, resetView) {
    const chatContainer = document.createElement('div');
    chatContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 600px;
        height: 80vh;
        max-height: 800px;
        min-height: 400px;
        background: rgba(0, 31, 0, 0.9);
        border: 2px solid #4e44ce;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        z-index: 999;
    `;

    const chatHeader = document.createElement('div');
    chatHeader.style.cssText = `
        padding: 15px;
        background: rgba(78, 68, 206, 0.3);
        border-bottom: 1px solid #4e44ce;
        color: #00ff00;
        font-family: system-ui, -apple-system, sans-serif;
        display: flex;
        align-items: center;
        gap: 10px;
    `;

    // Add token image to header
    const headerImage = document.createElement('img');
    headerImage.src = token.image_uri;
    headerImage.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50%;
    `;

    // Add token info to header
    const headerInfo = document.createElement('div');
    headerInfo.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 2px;
    `;

    const headerName = document.createElement('div');
    headerName.textContent = token.name;
    headerName.style.cssText = `
        font-weight: bold;
        font-size: 16px;
    `;

    const headerSymbol = document.createElement('div');
    headerSymbol.textContent = token.symbol;
    headerSymbol.style.cssText = `
        font-size: 12px;
        opacity: 0.8;
    `;

    headerInfo.appendChild(headerName);
    headerInfo.appendChild(headerSymbol);
    chatHeader.appendChild(headerImage);
    chatHeader.appendChild(headerInfo);

    const chatMessages = document.createElement('div');
    chatMessages.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;

    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
        padding: 10px;
        border-top: 1px solid #4e44ce;
        display: flex;
        gap: 8px;
    `;

    const input = document.createElement('input');
    input.placeholder = 'Type a message...';
    input.maxLength = 255;
    input.style.cssText = `
        flex: 1;
        padding: 8px;
        border: 1px solid #4e44ce;
        border-radius: 4px;
        background: rgba(0, 31, 0, 0.7);
        color: #00ff00;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    // Add input event listener for character count
    input.addEventListener('input', () => {
        if (input.value.length > 255) {
            input.value = input.value.substring(0, 255);
            showNotification('Message cannot exceed 255 characters');
        }
    });

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 8px;
        flex-shrink: 0;
    `;

    const sendButton = document.createElement('button');
    sendButton.textContent = 'Send';
    sendButton.style.cssText = `
        padding: 8px 16px;
        background: #4e44ce;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: system-ui, -apple-system, sans-serif;
        white-space: nowrap;
    `;

    const backButton = document.createElement('button');
    backButton.textContent = 'Back';
    backButton.style.cssText = `
        padding: 8px 16px;
        background: #ce4444;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: system-ui, -apple-system, sans-serif;
        transition: background 0.2s;
        white-space: nowrap;
    `;

    backButton.addEventListener('mouseenter', () => {
        backButton.style.background = '#a13535';
    });
    
    backButton.addEventListener('mouseleave', () => {
        backButton.style.background = '#ce4444';
    });

    backButton.addEventListener('click', () => {
        cleanup();
        resetView();
    });

    // Add message to chat
    function addMessage(message) {
        console.log('Received message:', message);
        const messageElement = document.createElement('div');
        messageElement.style.cssText = `
            padding: 8px;
            background: rgba(78, 68, 206, 0.1);
            border-radius: 4px;
            color: #00ff00;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 14px;
        `;
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString();
        const balance = message.balance ? ` [${message.balance.toLocaleString()} ${token.symbol}]` : '';
        console.log('Formatting message with balance:', balance);
        
        messageElement.innerHTML = `
            <strong>${message.username}</strong>${balance} <span style="color: #666;">${timestamp}</span><br>
            ${message.message}
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Handle sending messages
    async function sendMessage() {
        const message = input.value.trim();
        if (!message) return;
        
        if (message.length > 255) {
            showNotification('Message cannot exceed 255 characters');
            return;
        }

        if (displayText.startsWith('HELLO, ')) {
            const username = displayText.slice(7, -1);
            
            // Check cooldown
            const lastMessageTime = userLastMessage.get(username) || 0;
            const currentTime = Date.now();
            const timeElapsed = (currentTime - lastMessageTime) / 1000; // Convert to seconds
            
            if (timeElapsed < 15) {
                const remainingTime = Math.ceil(15 - timeElapsed);
                showNotification(`Please wait ${remainingTime} seconds before sending another message`);
                return;
            }

            try {
                const response = await fetch('/getWalletAddress', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username })
                });
                
                const data = await response.json();
                if (data.wallet) {
                    console.log('Found wallet address:', data.wallet);
                    const balance = await checkTokenBalance(contractAddress, data.wallet);
                    console.log('Retrieved balance:', balance, typeof balance);
                    
                    if (balance < 100000) {
                        showNotification(`You need at least 100,000 ${token.symbol} to chat in this room`);
                        return;
                    }

                    // Update last message time
                    userLastMessage.set(username, currentTime);
                    
                    const messageData = {
                        contractAddress,
                        username,
                        message,
                        balance: Number(balance)
                    };
                    console.log('Emitting message data:', messageData);
                    
                    socket.emit('chatMessage', messageData);
                    input.value = '';
                }
            } catch (error) {
                console.error('Error getting wallet/balance:', error);
                showNotification('Error sending message');
            }
        } else if (!displayText.startsWith('HELLO, ')) {
            console.log('User not connected. Display text:', displayText);
            showNotification('Please connect your wallet to chat');
        }
    }

    sendButton.onclick = sendMessage;
    input.onkeypress = (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    };

    // Socket event handlers
    socket.emit('joinTokenChat', contractAddress);

    socket.on('chatHistory', (history) => {
        chatMessages.innerHTML = '';
        history.forEach(addMessage);
    });

    socket.on('newMessage', addMessage);

    // Cleanup function
    const cleanup = () => {
        socket.emit('leaveTokenChat', contractAddress);
        socket.off('chatHistory');
        socket.off('newMessage');
        window.removeEventListener('resize', handleResize);
        
        // Clear user's cooldown when leaving chat
        userLastMessage.delete(displayText.slice(7, -1));
        
        chatContainer.remove();
    };

    // Add window resize handler
    const handleResize = () => {
        chatContainer.style.height = '80vh';
        chatContainer.style.width = '90%';
    };
    
    window.addEventListener('resize', handleResize);

    // Assembly
    buttonContainer.appendChild(sendButton);
    buttonContainer.appendChild(backButton);
    inputContainer.appendChild(input);
    inputContainer.appendChild(buttonContainer);
    chatContainer.appendChild(chatHeader);
    chatContainer.appendChild(chatMessages);
    chatContainer.appendChild(inputContainer);
    document.body.appendChild(chatContainer);

    return cleanup;
}

// Update the token info display section in createHolderBoardInput
// Add this inside the try block after showing token info:
let chatCleanup = null;

button.addEventListener('click', async () => {
    if (button.textContent === 'Back') {
        if (chatCleanup) {
            chatCleanup();
            chatCleanup = null;
        }
        resetView();
        return;
    }
    
    const contractAddress = input.value.trim();
    if (contractAddress) {
        try {
            const API_URL = `https://frontend-api-v2.pump.fun/coins/${contractAddress}`;
            const response = await axios.get(API_URL);
            const token = response.data;

            // Update token info display
            tokenName.textContent = token.name;
            tokenSymbol.textContent = token.symbol;
            if (token.image_uri) {
                tokenImage.src = token.image_uri;
                tokenImage.style.display = 'block';
            }
            
            // Hide input and show token info
            input.style.display = 'none';
            tokenInfo.style.display = 'flex';
            button.textContent = 'Back';
            
            // Create chat interface
            if (chatCleanup) {
                chatCleanup();
            }
            chatCleanup = createChatInterface(contractAddress, token, resetView);
            
            console.log('Token Info:', token);
        } catch (error) {
            console.error('Error fetching token info:', error);
            showNotification('Error fetching token information. Please check the contract address.');
            tokenInfo.style.display = 'none';
        }
    } else {
        alert('Please enter a contract address');
    }
});

// Update checkTokenBalance function to use Solana Web3
async function checkTokenBalance(contractAddress, walletAddress) {
    try {
        console.log(`Checking balance for wallet ${walletAddress} on contract ${contractAddress}`);
        
        // Create connection
        const connection = new solanaWeb3.Connection('https://mainnet.helius-rpc.com/?api-key=9de0b45d-2c02-471d-91a0-808da4274b97');
        
        // Get balance of specific token from public wallet
        const tokenMint = new solanaWeb3.PublicKey(contractAddress);
        const publicAccounts = await connection.getParsedTokenAccountsByOwner(
            new solanaWeb3.PublicKey(walletAddress),
            { mint: tokenMint }
        );
        
        let balance = 0;
        if (publicAccounts.value.length > 0) {
            balance = publicAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        }
        
        console.log('Retrieved balance:', balance);
        return balance;
    } catch (error) {
        console.error('Error checking token balance:', error);
        return 0;
    }
}

// Add createLoginOverlay function
function createLoginOverlay() {
    const backgroundOverlay = document.createElement('div');
    backgroundOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
    `;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 31, 0, 0.9);
        padding: 40px 20px 20px;
        border-radius: 8px;
        border: 2px solid #4e44ce;
        z-index: 1000;
        width: 300px;
    `;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: none;
        border: none;
        color: #4e44ce;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
    `;
    closeBtn.onmouseenter = () => {
        closeBtn.style.background = 'rgba(78, 68, 206, 0.2)';
    };
    closeBtn.onmouseleave = () => {
        closeBtn.style.background = 'none';
    };
    closeBtn.onclick = () => {
        backgroundOverlay.remove();
        overlay.remove();
    };

    // Username input
    const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.placeholder = 'Username';
    usernameInput.style.cssText = `
        display: block;
        width: 100%;
        margin: 10px 0;
        padding: 10px;
        border: 1px solid #4e44ce;
        border-radius: 4px;
        background: rgba(0, 31, 0, 0.7);
        color: #00ff00;
        font-family: system-ui, -apple-system, sans-serif;
        box-sizing: border-box;
    `;

    // Password input
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.placeholder = 'Password';
    passwordInput.style.cssText = usernameInput.style.cssText;

    // Login button
    const loginBtn = document.createElement('button');
    loginBtn.textContent = 'Log In';
    loginBtn.style.cssText = `
        display: block;
        width: 100%;
        margin: 20px 0 10px 0;
        padding: 10px;
        background: #4e44ce;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    loginBtn.onclick = async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            showNotification('Please fill in all fields');
            return;
        }

        // Verify login credentials
        socket.emit('verifyLogin', { username, password }, (response) => {
            if (response.success) {
                displayText = `HELLO, ${username}!`;
                backgroundOverlay.remove();
                overlay.remove();
                
                // Remove auth buttons after successful login
                if (buttonContainer) {
                    buttonContainer.remove();
                }
                showNotification('Successfully logged in', 'success');
            } else {
                showNotification('Invalid username or password');
            }
        });
    };

    // Assembly
    overlay.appendChild(closeBtn);
    overlay.appendChild(usernameInput);
    overlay.appendChild(passwordInput);
    overlay.appendChild(loginBtn);
    document.body.appendChild(backgroundOverlay);
    document.body.appendChild(overlay);
}

// Add notification system
function showNotification(message, type = 'error') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: -100px;
        left: 50%;
        transform: translateX(-50%);
        padding: 15px 25px;
        border-radius: 4px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 16px;
        color: white;
        background: ${type === 'error' ? '#ce4444' : '#2e8b57'};
        z-index: 1001;
        transition: top 0.3s ease-in-out;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        white-space: nowrap;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Slide down
    setTimeout(() => {
        notification.style.top = '20px';
    }, 100);

    // Slide up and remove
    setTimeout(() => {
        notification.style.top = '-100px';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

 