const isLog = false;

export function solveMinesweeper(field, size, totalMines) {
    log("start", { size, totalMines });

    const board = parseBoard(field, size);

    applyLocalRulesUntilStable(board, size);

    const local = collectLocalRules(board, size);

    const frontierData = buildFrontiers(board, size);
    log("frontierCells", frontierData.size);

    const frontiers = splitIndependentFrontiers(board, frontierData, size);
    log("frontiersCount", frontiers.length);

    const result = solveFrontiers(board, frontiers, size, totalMines);

    if (result instanceof Map) {
        for (const [x, y] of local.safe) result.set(key(x, y), 0);
        for (const [x, y] of local.mines) result.set(key(x, y), 1);
    } else {
        result.safe = [...local.safe, ...(result.safe || [])];
        result.mines = [...local.mines, ...(result.mines || [])];
    }

    log("result", result);
    return result;
}

function collectLocalRules(board, size) {
    const safe = [];
    const mines = [];

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const cell = board[y][x];
            if (cell.t === "flag") mines.push([x, y]);
            else if (cell.safe) safe.push([x, y]);
        }
    }

    return { safe, mines };
}

function log(tag, data) {
    isLog && console.log("[MS]", tag, data);
}

function parseBoard(field, size) {
    log("parseBoard");
    const board = new Array(size);
    for (let y = 0; y < size; y++) {
        board[y] = new Array(size);
        for (let x = 0; x < size; x++) {
            const v = field[y][x];
            if (v === ".") board[y][x] = { t: "closed" };
            else if (v === "M") board[y][x] = { t: "flag" };
            else board[y][x] = { t: "open", n: Number(v) };
        }
    }
    return board;
}

function neighbors(x, y, size) {
    const res = [];
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < size && ny < size) {
                res.push([nx, ny]);
            }
        }
    }
    return res;
}

function buildFrontiers(board, size) {
    log("buildFrontiers");
    const frontier = new Set();
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const cell = board[y][x];
            if (cell.t !== "open") continue;
            for (const [nx, ny] of neighbors(x, y, size)) {
                if (board[ny][nx].t === "closed") {
                    frontier.add(key(nx, ny));
                }
            }
        }
    }
    return frontier;
}

function applyLocalRulesUntilStable(board, size) {
    log("localRulesStart");

    let changed = true;
    let iter = 0;

    while (changed) {
        changed = false;
        iter++;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {

                const cell = board[y][x];
                if (cell.t !== "open") continue;

                const ns = neighbors(x, y, size);

                let flags = 0;
                const closed = [];

                for (const [nx, ny] of ns) {
                    const n = board[ny][nx];

                    if (n.t === "flag") {
                        flags++;
                    } else if (n.t === "closed" && !n.safe) {
                        closed.push([nx, ny]);
                    }
                }

                if (closed.length === 0) continue;

                const remaining = cell.n - flags;

                if (remaining === 0) {
                    for (const [cx, cy] of closed) {
                        const n = board[cy][cx];
                        if (!n.safe) {
                            n.safe = true;
                            changed = true;
                            log("localSafe", [cx, cy]);
                        }
                    }
                }

                if (remaining === closed.length) {
                    for (const [cx, cy] of closed) {
                        const n = board[cy][cx];
                        if (n.t !== "flag") {
                            n.t = "flag";
                            changed = true;
                            log("localMine", [cx, cy]);
                        }
                    }
                }

            }
        }
    }

    log("localRulesEnd", { iterations: iter });
}

function splitIndependentFrontiers(board, frontierSet, size) {
    log("splitFrontiers");

    const frontierKeys = [...frontierSet];
    if (frontierKeys.length === 0) return [];

    const frontierCoords = frontierKeys.map(fromKey);

    const constraints = buildConstraints(board, frontierCoords, size);

    const graph = new Map();
    for (const k of frontierKeys) {
        graph.set(k, new Set());
    }

    for (const c of constraints) {
        const vars = c.vars;
        for (let i = 0; i < vars.length; i++) {
            for (let j = i + 1; j < vars.length; j++) {
                graph.get(vars[i]).add(vars[j]);
                graph.get(vars[j]).add(vars[i]);
            }
        }
    }

    const visited = new Set();
    const frontiers = [];

    for (const start of frontierKeys) {
        if (visited.has(start)) continue;

        const stack = [start];
        const component = [];

        while (stack.length) {
            const cur = stack.pop();
            if (visited.has(cur)) continue;

            visited.add(cur);
            component.push(fromKey(cur));

            for (const nxt of graph.get(cur)) {
                if (!visited.has(nxt)) {
                    stack.push(nxt);
                }
            }
        }

        log("frontierGroup", component.length);
        frontiers.push(component);
    }

    return frontiers;
}

function solveFrontiers(board, frontiers, size, totalMines) {
    log("solveFrontiers");
    const safe = [];
    const mines = [];
    const probability = new Map();

    const flagged = countFlags(board, size);
    const remainingMines = totalMines - flagged;
    log("remainingMines", remainingMines);

    const tasks = frontiers.map(f =>
        f.length <= 30
            ? bruteForceFrontier(board, f, size, remainingMines)
            : monteCarloFrontier(board, f, size, remainingMines)
    );

    for (const res of tasks) {
        for (const k of res.safe) safe.push(k);
        for (const k of res.mines) mines.push(k);
        for (const [k, v] of res.prob) probability.set(k, v);
    }

    if (safe.length === 0) {
        log("probabilityReturn");
        return probability;
    }

    return { safe, mines };
}

function bruteForceFrontier(board, frontier, size, remainingMines) {
    log("bruteforceStart", frontier.length);
    const vars = frontier.map(([x, y]) => key(x, y));
    const constraints = buildConstraints(board, frontier, size);

    const counts = new Map();
    vars.forEach(v => counts.set(v, 0));

    let total = 0;

    const assign = new Map();

    function dfs(i, minesUsed) {
        if (minesUsed > remainingMines) return;
        if (i === vars.length) {
            if (!checkConstraints(assign, constraints)) return;
            total++;
            for (const v of vars) {
                if (assign.get(v)) counts.set(v, counts.get(v) + 1);
            }
            return;
        }
        assign.set(vars[i], false);
        if (partialCheck(assign, constraints)) dfs(i + 1, minesUsed);
        assign.set(vars[i], true);
        if (partialCheck(assign, constraints)) dfs(i + 1, minesUsed + 1);
        assign.delete(vars[i]);
    }

    dfs(0, 0);

    log("bruteforceEnd", { configs: total });

    const safe = [];
    const mines = [];
    const prob = new Map();

    if (total === 0) return { safe, mines, prob };

    for (const v of vars) {
        const c = counts.get(v);
        if (c === 0) safe.push(fromKey(v));
        else if (c === total) mines.push(fromKey(v));
        else prob.set(v, c / total);
    }

    return { safe, mines, prob };
}

function monteCarloFrontier(board, frontier, size, remainingMines) {
    log("monteCarloStart", frontier.length);
    const vars = frontier.map(([x, y]) => key(x, y));
    const constraints = buildConstraints(board, frontier, size);

    const counts = new Map();
    vars.forEach(v => counts.set(v, 0));

    let total = 0;
    const end = performance.now() + 5000;

    while (performance.now() < end) {
        const assign = randomAssignment(vars, remainingMines);
        if (!checkConstraints(assign, constraints)) continue;
        total++;
        for (const v of vars) {
            if (assign.get(v)) counts.set(v, counts.get(v) + 1);
        }
    }

    log("monteCarloEnd", { samples: total });

    const safe = [];
    const mines = [];
    const prob = new Map();

    if (total === 0) return { safe, mines, prob };

    for (const v of vars) {
        const c = counts.get(v);
        if (c === 0) safe.push(fromKey(v));
        else if (c === total) mines.push(fromKey(v));
        else prob.set(v, c / total);
    }

    return { safe, mines, prob };
}

function buildConstraints(board, frontier, size) {
    const frontierSet = new Set(frontier.map(([x, y]) => key(x, y)));
    const constraints = [];

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const cell = board[y][x];
            if (cell.t !== "open") continue;

            const vars = [];
            let flags = 0;

            for (const [nx, ny] of neighbors(x, y, size)) {
                const k = key(nx, ny);
                const n = board[ny][nx];
                if (n.t === "flag") flags++;
                else if (frontierSet.has(k)) vars.push(k);
            }

            if (vars.length > 0) {
                constraints.push({
                    vars,
                    target: cell.n - flags
                });
            }
        }
    }

    log("constraintsBuilt", constraints.length);
    return constraints;
}

function checkConstraints(assign, constraints) {
    for (const c of constraints) {
        let sum = 0;
        for (const v of c.vars) if (assign.get(v)) sum++;
        if (sum !== c.target) return false;
    }
    return true;
}

function partialCheck(assign, constraints) {
    for (const c of constraints) {
        let sum = 0;
        let unknown = 0;
        for (const v of c.vars) {
            if (!assign.has(v)) unknown++;
            else if (assign.get(v)) sum++;
        }
        if (sum > c.target) return false;
        if (sum + unknown < c.target) return false;
    }
    return true;
}

function randomAssignment(vars, remainingMines) {
    const assign = new Map();
    let mines = remainingMines;
    for (const v of vars) {
        const val = Math.random() < 0.5 && mines > 0;
        assign.set(v, val);
        if (val) mines--;
    }
    return assign;
}

function countFlags(board, size) {
    let c = 0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (board[y][x].t === "flag") c++;
        }
    }
    return c;
}

function key(x, y) {
    return x + "," + y;
}

function fromKey(k) {
    const s = k.split(",");
    return [Number(s[0]), Number(s[1])];
}
