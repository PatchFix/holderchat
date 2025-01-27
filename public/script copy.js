const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const socket = io(); // Initialize Socket.IO client

let width, height;
let publicKey = null;
let wallet = null;

let displayText = 'HELLO';
let currentGroup = {
    name: 'none',
    members: [],
    tokens: [],
    portal: 'none'
};

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
     
// Create connect button in top right
function createConnectButton() {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        display: flex;
        gap: 10px;
        z-index: 998;
    `;
    
    const connectBtn = document.createElement('button');
    connectBtn.textContent = 'Connect';
    connectBtn.style.cssText = `
        padding: 10px 20px;
        background: #4e44ce;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: system-ui, -apple-system, sans-serif;
        transition: background 0.2s;
    `;
    
    const groupBtn = document.createElement('button');
    groupBtn.textContent = 'Join Group';
    groupBtn.className = 'group-button';
    groupBtn.style.cssText = connectBtn.style.cssText + 'background: #2e8b57;';
    
    // Initially disable group button
    if (!publicKey) {
        groupBtn.style.opacity = '0.5';
        groupBtn.style.cursor = 'not-allowed';
    }
    
    groupBtn.addEventListener('click', showGroupPrompt);
    const handleClick = () => createWalletOverlay();
    connectBtn.addEventListener('click', handleClick);
    
    buttonContainer.appendChild(groupBtn);
    buttonContainer.appendChild(connectBtn);
    document.body.appendChild(buttonContainer);
}

// Update window load event listener
window.addEventListener('load', () => {
    createConnectButton();
    createColumnsContainer();
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
        margin-top: 20px;
        color: #1a1a1a;
    `;
    
    const headerText = document.createElement('h3');
    headerText.textContent = 'Link Wallet';
    headerText.style.cssText = `
        margin: 0;
        font-size: 16px;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    
    const subheaderText = document.createElement('p');
    subheaderText.textContent = '(No Connection Required)';
    subheaderText.style.cssText = `
        margin: 5px 0;
        font-size: 12px;
        opacity: 0.8;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    
    header.appendChild(headerText);
    header.appendChild(subheaderText);
    overlay.appendChild(header);

    // Add Telegram buttons
    const verifyTgBtn = document.createElement('button');
    verifyTgBtn.textContent = 'Verify with TG';
    verifyTgBtn.style.cssText = baseButtonStyle + 'background: #1a4b8c;';
    verifyTgBtn.onclick = () => alert('Coming Soon!');
    overlay.appendChild(verifyTgBtn);

    const loginTgBtn = document.createElement('button');
    loginTgBtn.textContent = 'Login with TG';
    loginTgBtn.style.cssText = baseButtonStyle + 'background: #5aafed;';
    loginTgBtn.onclick = () => alert('Coming Soon!');
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

// Add function to check token balance
async function checkTokenBalance() {
    try {
        // Verify we're in a secure context with a valid wallet connection
        if (!wallet || !publicKey) {
            console.error('Invalid wallet state');
            return 0;
        }

        const connection = new solanaWeb3.Connection('https://mainnet.helius-rpc.com/?api-key=9de0b45d-2c02-471d-91a0-808da4274b97');
        const tokenMint = new solanaWeb3.PublicKey('HUVPbbr9QaDCJ9BQGcP94nzckm4nVYeDpwhWLcb5pump');
        const userPublicKey = new solanaWeb3.PublicKey(publicKey);

        // Get token account
        const tokenAccounts = await connection.getTokenAccountsByOwner(userPublicKey, {
            mint: tokenMint
        });

        if (tokenAccounts.value.length === 0) {
            console.log('No token account found - Balance is 0');
            return 0;
        }

        // Get balance
        const tokenAccount = tokenAccounts.value[0];
        const accountInfo = await connection.getParsedAccountInfo(tokenAccount.pubkey);
        const balance = accountInfo.value.data.parsed.info.tokenAmount.uiAmount;
        
        console.log('Token Balance:', balance);

        // Check if balance meets minimum requirement
        if (balance >= minBalance) {
            // Sign a message to verify wallet ownership
            const message = new TextEncoder().encode(`Login verification for ${publicKey}`);
            try {
                const signedMessage = await wallet.signMessage(message, 'utf8');
                if (signedMessage) {
                    // If signature is valid, proceed with login
                    await userLogin(publicKey);
                }
            } catch (signError) {
                console.error('Message signing failed:', signError);
            }
        }

        return balance;
    } catch (error) {
        console.error('Error checking token balance:', error);
        return 0;
    }
}

// Update connectWallet function
async function connectWallet(walletName) {
    try {
        let walletAdapter;
        if (walletName === 'phantom') {
            walletAdapter = window.solana;
            if (!walletAdapter?.isPhantom) {
                alert('Please install Phantom wallet');
                return;
            }
        } else if (walletName === 'solflare') {
            walletAdapter = window.solflare;
            if (!walletAdapter) {
                alert('Please install Solflare wallet');
                return;
            }
        }

        await walletAdapter.connect();
        wallet = walletAdapter;
        publicKey = wallet.publicKey.toString();
        
        // Close overlay first
        const bgOverlay = document.getElementById('wallet-background-overlay');
        const walletOverlay = document.getElementById('wallet-overlay');
        if (bgOverlay) bgOverlay.remove();
        if (walletOverlay) walletOverlay.remove();
        
        // Update connect button
        const connectBtn = document.querySelector('button[style*="background: #4e44ce"]');
        if (connectBtn) {
            connectBtn.textContent = publicKey.substring(0, 5);
            connectBtn.removeEventListener('click', () => createWalletOverlay());
            connectBtn.onclick = null;
        }
        
        // Enable group button
        const groupBtn = document.querySelector('.group-button');
        if (groupBtn) {
            groupBtn.style.opacity = '1';
            groupBtn.style.cursor = 'pointer';
        }
        
        // Check balance after UI updates
        await checkTokenBalance();
        
        console.log('Connected wallet:', publicKey);
    } catch (err) {
        console.error('Wallet connection error:', err);
        alert('Failed to connect wallet');
    }
}

// Add userLogin function
async function userLogin(walletAddress) {
    // Get first 5 characters of wallet address
    const shortAddress = walletAddress.substring(0, 5);
    displayText = `HELLO, ${shortAddress}!`;
    console.log('User logged in:', shortAddress);
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
function createColumnsContainer() {
    const columnsContainer = document.createElement('div');
    columnsContainer.id = 'columns-container';
    columnsContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        justify-content: space-between;
        padding: 15px;
        margin-top: 80px;
        height: calc(100vh - 95px);
        gap: 15px;
        pointer-events: none;
        z-index: 1;
    `;

    // Create three columns
    for (let i = 0; i < 3; i++) {
        const column = document.createElement('div');
        column.className = 'column';
        column.style.cssText = `
            flex: 1;
            background: rgba(0, 50, 0, 0.3);
            border-radius: 8px;
            padding: 12px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: auto;
        `;

        // Update the card creation part
        for (let j = 0; j < 3; j++) {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.cssText = `
                background: rgba(26, 26, 26, 0.95);
                border: 1px solid rgba(0, 255, 0, 0.2);
                border-radius: 12px;
                padding: 15px;
                color: #ffffff;
                display: flex;
                gap: 15px;
                align-items: center;
                backdrop-filter: blur(10px);
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                transition: transform 0.2s, border-color 0.2s;
                cursor: pointer;
            `;

            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-2px)';
                card.style.borderColor = 'rgba(0, 255, 0, 0.4)';
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
                card.style.borderColor = 'rgba(0, 255, 0, 0.2)';
            });

            // Left side content container
            const contentContainer = document.createElement('div');
            contentContainer.style.cssText = `
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 12px;
            `;

            // Token info container
            const infoContainer = document.createElement('div');
            infoContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 8px;
                font-family: system-ui, -apple-system, sans-serif;
            `;

            // Token name and symbol
            const nameSymbol = document.createElement('div');
            nameSymbol.style.cssText = `
                font-size: 18px;
                font-weight: 600;
                color: #ffffff;
                letter-spacing: -0.01em;
            `;
            nameSymbol.textContent = 'Token Name ($TKN)';

            // Called By information
            const calledBy = document.createElement('div');
            calledBy.style.cssText = `
                font-size: 14px;
                color: rgba(255, 255, 255, 0.8);
            `;
            calledBy.textContent = 'Called By: UserName';

            // Called Time information
            const calledTime = document.createElement('div');
            calledTime.style.cssText = `
                font-size: 14px;
                color: rgba(255, 255, 255, 0.8);
            `;
            calledTime.textContent = 'Called: 1 hour, 15 minutes';

            // Price information
            const priceInfo = document.createElement('div');
            priceInfo.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 6px;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.8);
                margin-top: 8px;
            `;

            let callNum = 64800;
            let currNum = 142000;
            let xNum = Number((currNum/callNum).toFixed(2));
            
            const callPrice = document.createElement('div');
            callPrice.textContent = `Call: $${callNum.toLocaleString()}`;
            
            const currentPrice = document.createElement('div');
            currentPrice.textContent = `Now: $${currNum.toLocaleString()}`;

            const multiplier = document.createElement('div');
            multiplier.textContent = `${xNum}x`;
            multiplier.style.cssText = `
                color: #4ade80;
                font-weight: 600;
                font-size: 16px;
            `;

            priceInfo.appendChild(callPrice);
            priceInfo.appendChild(currentPrice);
            priceInfo.appendChild(multiplier);

            infoContainer.appendChild(nameSymbol);
            infoContainer.appendChild(calledBy);
            infoContainer.appendChild(calledTime);
            infoContainer.appendChild(priceInfo);

            // Right side container for image and links
            const rightContainer = document.createElement('div');
            rightContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 12px;
                align-items: center;
                flex-shrink: 0;
            `;

            // Image container
            const imageContainer = document.createElement('div');
            imageContainer.style.cssText = `
                width: 80px;
                height: 80px;
                flex-shrink: 0;
                border-radius: 50%;
                overflow: hidden;
                border: 2px solid rgba(74, 222, 128, 0.3);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            `;

            const image = document.createElement('img');
            image.src = 'https://via.placeholder.com/150';
            image.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
            `;
            imageContainer.appendChild(image);

            // Social links container (vertical under image)
            const socialLinksContainer = document.createElement('div');
            socialLinksContainer.style.cssText = `
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                justify-content: center;
            `;

            // Add social links
            ['X', 'TG', 'DC', 'WP'].forEach(link => {
                const linkBtn = document.createElement('a');
                linkBtn.href = '#';
                linkBtn.textContent = link;
                linkBtn.style.cssText = `
                    color: #4ade80;
                    text-decoration: none;
                    background: rgba(74, 222, 128, 0.1);
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    font-family: system-ui, -apple-system, sans-serif;
                    transition: all 0.2s;
                `;

                linkBtn.addEventListener('mouseenter', () => {
                    linkBtn.style.background = 'rgba(74, 222, 128, 0.2)';
                });

                linkBtn.addEventListener('mouseleave', () => {
                    linkBtn.style.background = 'rgba(74, 222, 128, 0.1)';
                });

                socialLinksContainer.appendChild(linkBtn);
            });

            // Resource links container (horizontal below social links)
            const resourceLinksContainer = document.createElement('div');
            resourceLinksContainer.style.cssText = `
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                justify-content: center;
                margin-top: 8px;
                width: 100%;
            `;

            // Add resource links horizontally
            ['B', 'C', 'D', 'E'].forEach(link => {
                const linkBtn = document.createElement('a');
                linkBtn.href = '#';
                linkBtn.textContent = link;
                linkBtn.style.cssText = `
                    color: #4ade80;
                    text-decoration: none;
                    background: rgba(74, 222, 128, 0.1);
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    font-family: system-ui, -apple-system, sans-serif;
                    transition: all 0.2s;
                `;

                linkBtn.addEventListener('mouseenter', () => {
                    linkBtn.style.background = 'rgba(74, 222, 128, 0.2)';
                });

                linkBtn.addEventListener('mouseleave', () => {
                    linkBtn.style.background = 'rgba(74, 222, 128, 0.1)';
                });

                resourceLinksContainer.appendChild(linkBtn);
            });

            rightContainer.appendChild(imageContainer);
            rightContainer.appendChild(socialLinksContainer);
            rightContainer.appendChild(resourceLinksContainer);
            
            contentContainer.appendChild(infoContainer);
            card.appendChild(contentContainer);
            card.appendChild(rightContainer);
            
            column.appendChild(card);
        }

        columnsContainer.appendChild(column);
    }

    document.body.appendChild(columnsContainer);
}

