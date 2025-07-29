const messageForm = document.querySelector(".prompt__form");
const chatHistoryContainer = document.querySelector(".chats");
const suggestionItems = document.querySelectorAll(".suggests__item");
const themeToggleButton = document.getElementById("themeToggler");
const clearChatButton = document.getElementById("deleteButton");

let currentUserMessage = null;
let isGeneratingResponse = false;

const GOOGLE_API_KEY = "your_api_key";
const API_REQUEST_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

// === Load saved chat history ===
const loadSavedChatHistory = () => {
    const savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
    const isLightTheme = localStorage.getItem("themeColor") === "light_mode";

    document.body.classList.toggle("light_mode", isLightTheme);
    themeToggleButton.innerHTML = isLightTheme ? '<i class="bx bx-moon"></i>' : '<i class="bx bx-sun"></i>';

    chatHistoryContainer.innerHTML = '';

    savedConversations.forEach(convo => {
        const avatar = convo.role === "user" ? "assets/gemini.png" : "assets/profile.png";
        const avatarClass = convo.role === "user" ? "message__avatar rotating" : "message__avatar";

        const messageHtml = `
            <div class="message__content">
                <img class="${avatarClass}" src="${avatar}" alt="${convo.role} avatar">
                <p class="message__text"></p>
                <div class="message__loading-indicator hide">
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                </div>
            </div>
            <span onClick="copyMessageToClipboard(this)" class="message__icon ${convo.role === "gemini" ? "" : "hide"}"><i class='bx bx-copy-alt'></i></span>
        `;

        const msgElement = createChatMessageElement(messageHtml, `message--${convo.role}`);
        chatHistoryContainer.appendChild(msgElement);

        const msgText = msgElement.querySelector(".message__text");

        if (convo.role === "gemini") {
            showTypingEffect(convo.raw, convo.html, msgText, msgElement, true);
        } else {
            msgText.innerText = convo.message;
        }
    });

    document.body.classList.toggle("hide-header", savedConversations.length > 0);
};

// === Helpers ===
const createChatMessageElement = (htmlContent, ...cssClasses) => {
    const el = document.createElement("div");
    el.classList.add("message", ...cssClasses);
    el.innerHTML = htmlContent;
    return el;
};

const showTypingEffect = (rawText, htmlText, el, wrapper, skip = false) => {
    const copyIcon = wrapper.querySelector(".message__icon");
    copyIcon.classList.add("hide");

    if (skip) {
        el.innerHTML = htmlText;
        hljs.highlightAll();
        addCopyButtonToCodeBlocks();
        copyIcon.classList.remove("hide");
        isGeneratingResponse = false;
        return;
    }

    const words = rawText.split(" ");
    let i = 0;

    const interval = setInterval(() => {
        el.innerText += (i === 0 ? '' : ' ') + words[i++];
        if (i === words.length) {
            clearInterval(interval);
            el.innerHTML = htmlText;
            hljs.highlightAll();
            addCopyButtonToCodeBlocks();
            copyIcon.classList.remove("hide");
            isGeneratingResponse = false;
        }
    }, 75);
};

// === Send request to Gemini ===
const requestApiResponse = async (incomingEl) => {
    const el = incomingEl.querySelector(".message__text");

    try {
        const res = await fetch(API_REQUEST_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: currentUserMessage }] }]
            }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error.message);

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Invalid API response.");

        const html = marked.parse(text);
        showTypingEffect(text, html, el, incomingEl);

        const saved = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
        saved.push(
            { role: "user", message: currentUserMessage },
            { role: "gemini", message: text, raw: text, html: html }
        );
        localStorage.setItem("saved-api-chats", JSON.stringify(saved));

    } catch (err) {
        isGeneratingResponse = false;
        el.innerText = err.message;
        incomingEl.classList.add("message--error");
    } finally {
        incomingEl.classList.remove("message--loading");
    }
};

// === Code copy feature ===
const addCopyButtonToCodeBlocks = () => {
    const blocks = document.querySelectorAll("pre");
    blocks.forEach((block) => {
        const code = block.querySelector("code");
        const lang = [...code.classList].find(cls => cls.startsWith("language-"))?.replace("language-", "") || "Text";

        const label = document.createElement("div");
        label.classList.add("code__language-label");
        label.innerText = lang.charAt(0).toUpperCase() + lang.slice(1);
        block.appendChild(label);

        const copyBtn = document.createElement("button");
        copyBtn.classList.add("code__copy-btn");
        copyBtn.innerHTML = "<i class='bx bx-copy'></i>";
        block.appendChild(copyBtn);

        copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(code.innerText).then(() => {
                copyBtn.innerHTML = "<i class='bx bx-check'></i>";
                setTimeout(() => copyBtn.innerHTML = "<i class='bx bx-copy'></i>", 2000);
            });
        });
    });
};

// === Loading Message ===
const displayLoadingAnimation = () => {
    const loadingHtml = `
        <div class="message__content">
            <img class="message__avatar" src="assets/profile.png" alt="Gemini avatar">
            <p class="message__text"></p>
            <div class="message__loading-indicator">
                <div class="message__loading-bar"></div>
                <div class="message__loading-bar"></div>
                <div class="message__loading-bar"></div>
            </div>
        </div>
        <span onClick="copyMessageToClipboard(this)" class="message__icon hide"><i class='bx bx-copy-alt'></i></span>
    `;

    const loadingEl = createChatMessageElement(loadingHtml, "message--incoming", "message--loading");
    chatHistoryContainer.appendChild(loadingEl);
    requestApiResponse(loadingEl);
};

// === Copy Button ===
const copyMessageToClipboard = (btn) => {
    const text = btn.parentElement.querySelector(".message__text").innerText;
    navigator.clipboard.writeText(text);
    btn.innerHTML = "<i class='bx bx-check'></i>";
    setTimeout(() => btn.innerHTML = "<i class='bx bx-copy-alt'></i>", 1000);
};

// === Send Message ===
const handleOutgoingMessage = () => {
    currentUserMessage = messageForm.querySelector(".prompt__form-input").value.trim() || currentUserMessage;
    if (!currentUserMessage || isGeneratingResponse) return;

    isGeneratingResponse = true;

    const outgoingHtml = `
        <div class="message__content">
            <img class="message__avatar rotating" src="assets/gemini.png" alt="User avatar">
            <p class="message__text">${currentUserMessage}</p>
        </div>
    `;

    const msgEl = createChatMessageElement(outgoingHtml, "message--outgoing");
    chatHistoryContainer.appendChild(msgEl);

    messageForm.reset();
    document.body.classList.add("hide-header");
    setTimeout(displayLoadingAnimation, 500);
};

// === Theme Toggle ===
themeToggleButton.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light_mode");
    localStorage.setItem("themeColor", isLight ? "light_mode" : "dark_mode");
    themeToggleButton.querySelector("i").className = isLight ? "bx bx-moon" : "bx bx-sun";
});

// === Clear History ===
clearChatButton.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete all chat history?")) {
        localStorage.removeItem("saved-api-chats");
        loadSavedChatHistory();
        currentUserMessage = null;
        isGeneratingResponse = false;
    }
});

// === Suggestion click ===
suggestionItems.forEach(suggestion => {
    suggestion.addEventListener("click", () => {
        currentUserMessage = suggestion.querySelector(".suggests__item-text").innerText;
        handleOutgoingMessage();
    });
});

// === On Form Submit ===
messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleOutgoingMessage();
});

// === Initial Load ===
loadSavedChatHistory();
