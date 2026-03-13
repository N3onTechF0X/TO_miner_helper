let SIZE, MINES;
let board = [];
let cells = [];
let setMine = new Set();
let setSafe = new Set();
let mineProbability = new Map();
let bestProbability = null;

const saveState = () => {
    localStorage.setItem("minesweeper_helper", JSON.stringify({
        SIZE,
        MINES,
        board
    }));
};

const loadState = () => {
    const data = localStorage.getItem("minesweeper_helper");
    if (!data) return false;
    const state = JSON.parse(data);
    SIZE = state.SIZE;
    MINES = state.MINES;
    board = state.board;
    document.getElementById("levelSelect").value = SIZE - 6;
    init();
    return true;
};

const resetGame = () => {
    localStorage.removeItem("minesweeper_helper");
    setLevel(Number(document.getElementById("levelSelect").value));
};

const setLevel = (l) => {
    SIZE = 6 + Number(l);
    MINES = 6 + Number(l);
    board = [];
    init();
    saveState();
};

const init = () => {
    cells = [];
    setMine.clear();
    setSafe.clear();
    document.getElementById("info").textContent = "";
    const b = document.getElementById("board");
    b.innerHTML = "";

    for (let r = 0; r < SIZE; r++) {
        if (!board[r]) board[r] = [];
        const row = document.createElement("div");
        row.className = "row";

        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] === undefined) board[r][c] = ".";
            const cellDiv = document.createElement("div");
            cellDiv.className = "cell";
            cellDiv.addEventListener("click", () => leftClick(r, c));
            cellDiv.addEventListener("contextmenu", e => {
                e.preventDefault();
                rightClick(r, c);
            });
            cells.push({ r, c, d: cellDiv });
            row.appendChild(cellDiv);
        }
        b.appendChild(row);
    }

    cells.forEach(({ r, c }) => renderCell(r, c));
    solve();
};

const leftClick = (r, c) => cycle(r, c, 1);
const rightClick = (r, c) => cycle(r, c, -1);

const cycle = (r, c, dir) => {
    const seq = ['.', 0, 1, 2, 3, 4, 5, 6, 7, 8, 'M'];
    let idx = seq.indexOf(board[r][c]) + dir;
    if (idx < 0) idx = seq.length - 1;
    if (idx >= seq.length) idx = 0;
    board[r][c] = seq[idx];
    renderCell(r, c);
    solve();
    saveState();
};

const renderCell = (r, c) => {
    const { d } = cells[r * SIZE + c];
    const v = board[r][c];
    d.className = "cell";
    d.textContent = "";
    d.innerHTML = "";

    if (v === '.') {
        d.classList.add("unknown");
        const key = r * SIZE + c;

        if (setSafe.has(key)) d.classList.add("safe");
        else if (setMine.has(key)) d.classList.add("mine");
        else if (setSafe.size == 0 && mineProbability.has(key)) {
            const p = mineProbability.get(key);
            d.classList.add("percent");
            d.textContent = (p*100).toFixed(0) + "%";
            if (Math.abs(p - bestProbability) < 1e-9) {
                d.classList.add("danger");
            }
        }
    } else if (v === 'M') {
        d.classList.add("mine");
        const img = document.createElement("img");
        img.src = "https://ru-cache.tankionline.com/wp-content/uploads/2026/03/70-x-70.png";
        d.appendChild(img);
    } else {
        d.classList.add(`number-${v}`);
        d.textContent = v;
    }
};

const around = (r, c) => {
    const res = [];
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
            if (dr || dc) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) res.push({ nr, nc });
            }
    return res;
};

const updateInfo = t => {
    document.getElementById("info").textContent = t || "";
};

const solve = () => {
    setMine.clear();
    setSafe.clear();
    mineProbability.clear();
    bestProbability = null;

    const nums = [];
    for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
            if (typeof board[r][c] === "number") nums.push({ r, c, v: board[r][c] });

    for (const { r, c, v } of nums) {
        let marked = 0,
            hidden = 0;
        for (const { nr, nc } of around(r, c)) {
            const x = board[nr][nc];
            if (x === 'M') marked++;
            else if (x === '.') hidden++;
        }
        if (marked > v || marked + hidden < v) {
            updateInfo(`Поле невалидно, проверьте правильность ввода.`);
            return;
        }
    }

    const frontier = new Set();
    for (const { r, c } of nums)
        for (const { nr, nc } of around(r, c))
            if (board[nr][nc] === '.') frontier.add(nr * SIZE + nc);

    if (frontier.size === 0) {
        updateInfo("");
        cells.forEach(({ r, c }) => renderCell(r, c));
        return;
    }

    const frontierArr = [...frontier];
    const index = new Map();
    frontierArr.forEach((k, i) => index.set(k, i));

    const adj = Array.from({ length: frontierArr.length }, () => []);
    const cellToNum = new Map();
    frontierArr.forEach(key => {
        const r = Math.floor(key / SIZE),
            c = key % SIZE;
        cellToNum.set(key, []);
        for (const { nr, nc } of around(r, c)) {
            const val = board[nr][nc];
            if (typeof val === "number") cellToNum.get(key).push({ r: nr, c: nc, v: val });
        }
    });

    for (let i = 0; i < frontierArr.length; i++)
        for (let j = i + 1; j < frontierArr.length; j++) {
            const setI = new Set(cellToNum.get(frontierArr[i]).map(x => x.r * SIZE + x.c));
            const setJ = new Set(cellToNum.get(frontierArr[j]).map(x => x.r * SIZE + x.c));
            if ([...setI].some(x => setJ.has(x))) {
                adj[i].push(j);
                adj[j].push(i);
            }
        }

    const visited = Array(frontierArr.length).fill(false);
    const components = [];
    const dfsComp = (u, comp) => {
        visited[u] = true;
        comp.push(u);
        adj[u].forEach(v => {
            if (!visited[v]) dfsComp(v, comp);
        });
    };
    for (let i = 0; i < frontierArr.length; i++)
        if (!visited[i]) {
            const comp = [];
            dfsComp(i, comp);
            components.push(comp);
        }

    components.forEach(comp => {
        const n = comp.length;
        const statsComp = Array.from({ length: n }, () => ({ safe: 0, total: 0 }));

        const dfs = (pos, mask) => {
            if (pos === n) {
                for (const i of comp) {
                    const key = frontierArr[i];
                    for (const num of cellToNum.get(key)) {
                        let cnt = 0;
                        for (const { nr, nc } of around(num.r, num.c)) {
                            const k = nr * SIZE + nc;
                            if (board[nr][nc] === 'M') cnt++;
                            else if (frontier.has(k) && (mask & (1 << index.get(k)))) cnt++;
                        }
                        if (cnt !== num.v) return;
                    }
                }
                for (let i = 0; i < n; i++) {
                    statsComp[i].total++;
                    if (!(mask & (1 << comp[i]))) statsComp[i].safe++;
                }
                return;
            }
            dfs(pos + 1, mask | (1 << comp[pos]));
            dfs(pos + 1, mask);
        };

        if (n <= 20) dfs(0, 0);
        for (let i = 0; i < n; i++) {
            const key = frontierArr[comp[i]];
            const s = statsComp[i];
            if (s.total === 0) continue;
            const pMine = 1 - s.safe / s.total;
            mineProbability.set(key, pMine);
            if (s.safe === s.total) setSafe.add(key);
            else if (s.safe === 0) setMine.add(key);
        }
    });

    bestProbability = null;
    for (const p of mineProbability.values()) {
        if (bestProbability === null || p < bestProbability) bestProbability = p;
    }
    cells.forEach(({ r, c }) => renderCell(r, c));
    updateInfo("");
};

document.getElementById("levelSelect").addEventListener("change", e => setLevel(e.target.value));
document.getElementById("resetBtn").addEventListener("click", resetGame);
if (!loadState()) setLevel(1);