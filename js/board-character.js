(function () {
    var lines = [
        "欢迎回来。",
        "今天也要写点什么吗？",
        "欸，被你发现啦。",
        "慢慢看，我就在这里。",
        "别偷懒哦。"
    ];

    function pickLine() {
        return lines[Math.floor(Math.random() * lines.length)];
    }

    var style = document.createElement("style");
    style.textContent = [
        ".board-character{position:fixed;right:18px;bottom:0;z-index:10000;width:auto;pointer-events:auto;user-select:none;}",
        ".board-character__bubble{position:absolute;right:82%;bottom:72%;min-width:132px;max-width:210px;padding:9px 11px;border:1px solid rgba(255,255,255,.68);border-radius:8px;background:rgba(32,36,48,.82);color:#fff;font-size:13px;line-height:1.45;text-align:center;box-shadow:0 10px 28px rgba(0,0,0,.24);opacity:0;transform:translateY(8px);transition:opacity .24s ease,transform .24s ease;}",
        ".board-character__bubble.is-visible{opacity:1;transform:translateY(0);}",
        ".board-character__figure{display:block;width:auto;height:clamp(360px,60vh,560px);filter:drop-shadow(0 12px 22px rgba(0,0,0,.24));transform-origin:50% 96%;animation:board-breathe 4.6s ease-in-out infinite;cursor:pointer;}",
        ".board-character__figure:hover{animation:board-breathe 2.8s ease-in-out infinite,board-sway 1.8s ease-in-out infinite;}",
        "@keyframes board-breathe{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-5px) scale(1.012)}}",
        "@keyframes board-sway{0%,100%{rotate:0deg}50%{rotate:1.5deg}}",
        "@media (max-width:860px){.board-character{display:none!important;}}"
    ].join("");
    document.head.appendChild(style);

    var root = document.createElement("div");
    root.className = "board-character";
    root.innerHTML = '<div class="board-character__bubble" role="status"></div><img class="board-character__figure" src="/lulu_blog/img/board-character.png" alt="看板人物">';
    document.body.appendChild(root);

    var bubble = root.querySelector(".board-character__bubble");
    var figure = root.querySelector(".board-character__figure");
    var timer = null;

    function showLine(text) {
        bubble.textContent = text || pickLine();
        bubble.classList.add("is-visible");
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
            bubble.classList.remove("is-visible");
        }, 3600);
    }

    figure.addEventListener("click", function () {
        showLine();
    });

    window.setTimeout(function () {
        showLine("欢迎来到 Eric 的博客。");
    }, 1200);
})();
