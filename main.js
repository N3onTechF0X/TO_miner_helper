import { solveMinesweeper } from "./solver.js";

let SIZE, MINES;
let board = [];
let cells = [];

let setMine = new Set();
let setSafe = new Set();
let mineProbability = new Map();
let bestProbability = null;

const saveState = () => {
    localStorage.setItem("minesweeper_helper", JSON.stringify({ SIZE, MINES, board }));
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
    mineProbability.clear();
    bestProbability = null;

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
};

const leftClick = (r, c) => cycle(r, c, 1);
const rightClick = (r, c) => cycle(r, c, -1);

const cycle = (r, c, dir) => {
    const seq = ['.', '0', '1', '2', '3', '4', '5', 'M'];

    let idx = seq.indexOf(String(board[r][c])) + dir;
    if (idx < 0) idx = seq.length - 1;
    if (idx >= seq.length) idx = 0;

    board[r][c] = seq[idx];

    renderCell(r, c);
    saveState();
};

const renderCell = (r, c) => {
    const { d } = cells[r * SIZE + c];
    const v = board[r][c];

    d.className = "cell";
    d.textContent = "";
    d.innerHTML = "";

    const key = r * SIZE + c;

    if (v === '.') {

        d.classList.add("unknown");

        if (setSafe.has(key)) {
            d.classList.add("safe");
        }
        else if (setMine.has(key)) {
            d.classList.add("mine");
        }
        else if (setSafe.size === 0 && mineProbability.has(key)) {

            const p = mineProbability.get(key);

            d.classList.add("percent");
            d.textContent = (p * 100).toFixed(0) + "%";

            if (bestProbability !== null && Math.abs(p - bestProbability) < 1e-9)
                d.classList.add("danger");
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

const updateInfo = t => {
    document.getElementById("info").textContent = t || "";
};

const buildSolverField = () => {
    const f = new Array(SIZE);

    for (let r = 0; r < SIZE; r++) {
        f[r] = new Array(SIZE);
        for (let c = 0; c < SIZE; c++) {
            f[r][c] = String(board[r][c]);
        }
    }

    return f;
};

const solve = () => {
    const solverField = buildSolverField();

    const result = solveMinesweeper(solverField, SIZE, MINES);

    setMine.clear();
    setSafe.clear();
    mineProbability.clear();
    bestProbability = null;

    if (typeof result === "string") {
        updateInfo(result);
        cells.forEach(({ r, c }) => renderCell(r, c));
        return;
    }

    if (result.safe) {
        for (const [x, y] of result.safe) {
            setSafe.add(y * SIZE + x);
        }
    }

    if (result.mines) {
        for (const [x, y] of result.mines) {
            setMine.add(y * SIZE + x);
        }
    }

    if (result instanceof Map) {
        for (const [k, p] of result.entries()) {
            const [x, y] = k.split(",").map(Number);
            mineProbability.set(y * SIZE + x, p);
        }
    }

    if (setSafe.size === 0 && mineProbability.size > 0) {
        let min = Infinity;
        for (const p of mineProbability.values())
            if (p < min) min = p;
        bestProbability = min;
    }

    cells.forEach(({ r, c }) => renderCell(r, c));
    updateInfo("");
};

document.getElementById("levelSelect").addEventListener("change", e => setLevel(e.target.value));
document.getElementById("resetBtn").addEventListener("click", resetGame);
document.getElementById("solveBtn").addEventListener("click", solve);

if (!loadState()) setLevel(1);
