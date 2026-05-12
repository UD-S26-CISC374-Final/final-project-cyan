/**
 * python-executor.ts
 *
 * A lightweight Python-like execution engine for Detective Code.
 *
 * Key change: LevelFunction now returns { dialogue, value } so that
 * the word bubble (dialogue) and the actual computed value used by
 * the printer/trace table (value) can be different.
 */

/**
 * The return type for every level function.
 *   dialogue — shown in the telephone word bubble
 *   value    — used as the actual return value for assignments,
 *              print() output, nested call arguments, and the trace table
 */
export interface FunctionResult {
    dialogue: string;
    value: string;
}

export type LevelFunction = (
    ...args: (string | number | boolean)[]
) => FunctionResult;

export interface LineResult {
    type: "print" | "call" | "assign" | "comment" | "empty" | "error";
    output: string; // the computed value (FunctionResult.value)
    dialogue: string; // the dialogue string (FunctionResult.dialogue)
    printedValue: string; // what was passed to print(), if anything
    functionName: string;
    args: (string | number | boolean)[];
}

export interface FunctionSpan {
    name: string;
    nameStart: number;
    nameEnd: number;
    fullExpression: string;
    depth: number;
}

export interface TraceEntry {
    step: number;
    event: "call" | "return";
    functionName: string;
    args: (string | number | boolean)[];
    returnValue: string;
}

export class PythonExecutor {
    private variables: Record<string, string | number | boolean | undefined> =
        {};
    private functions: Record<string, LevelFunction | undefined> = {};
    private printOutput: string[] = [];
    private traceLog: TraceEntry[] = [];
    private traceCounter = 1;

    constructor(functions: Record<string, LevelFunction>) {
        this.functions = { ...functions };
    }

    // ── Public API ────────────────────────────────────────────────────────────

    loadTranscript(transcript: string) {
        const lines = transcript.split("\n");
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            this.executeAssignment(trimmed);
        }
    }

    runLine(line: string): LineResult {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            return this.makeResult("comment", "", "", "", "", []);
        }
        try {
            if (this.isAssignment(trimmed)) {
                return this.executeAssignment(trimmed);
            }
            return this.executeExpression(trimmed);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return this.makeResult("error", message, "", "", "", []);
        }
    }

    runAll(terminalContent: string): LineResult[] {
        this.printOutput = [];
        const lines = terminalContent.split("\n");
        const results: LineResult[] = [];
        for (const line of lines) {
            results.push(this.runLine(line));
        }
        return results;
    }

    runLinesAbove(terminalContent: string, lineIndex: number) {
        const lines = terminalContent.split("\n");
        for (let i = 0; i < lineIndex; i++) {
            this.runLine(lines[i]);
        }
    }

    getPrintOutput(): string {
        return this.printOutput.join("\n");
    }

    reset() {
        this.printOutput = [];
        this.traceLog = [];
        this.traceCounter = 1;
    }

    resetPlayerVariables() {
        this.variables = {};
    }

    getTraceLog(): TraceEntry[] {
        return [...this.traceLog];
    }

    // ── Telephone support ─────────────────────────────────────────────────────

    findAllFunctionSpans(line: string): FunctionSpan[] {
        const spans: FunctionSpan[] = [];
        this.scanForFunctions(line, 0, 0, spans);
        return spans;
    }

    findFunctionAtColumn(line: string, col: number): FunctionSpan | null {
        const spans = this.findAllFunctionSpans(line);
        const matching = spans.filter(
            (s) => col >= s.nameStart && col < s.nameEnd,
        );
        if (matching.length === 0) return null;
        return matching.reduce((best, s) => (s.depth > best.depth ? s : best));
    }

    callForTelephone(expression: string): LineResult {
        const trimmed = expression.trim();
        try {
            return this.executeExpression(trimmed);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return this.makeResult("error", message, "", "", "", []);
        }
    }

    // ── Execution internals ───────────────────────────────────────────────────

    private executeAssignment(line: string): LineResult {
        const eqIndex = line.indexOf("=");
        if (eqIndex === -1) return this.makeResult("empty", "", "", "", "", []);

        const varName = line.slice(0, eqIndex).trim();
        const rhs = line.slice(eqIndex + 1).trim();

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
            return this.makeResult(
                "error",
                `Invalid variable name: ${varName}`,
                "",
                "",
                "",
                [],
            );
        }

        const value = this.evaluateExpression(rhs);
        this.variables[varName] = value;

        return this.makeResult("assign", String(value), "", "", varName, []);
    }

    private executeExpression(expression: string): LineResult {
        const callMatch = this.parseFunctionCall(expression);

        if (callMatch === null) {
            return this.makeResult(
                "error",
                `Cannot parse: ${expression}`,
                "",
                "",
                "",
                [],
            );
        }

        const { name, args: rawArgs } = callMatch;
        const resolvedArgs = rawArgs.map((arg) => this.evaluateExpression(arg));

        // print() uses the value of its argument directly
        if (name === "print") {
            const printed = resolvedArgs.map((a) => String(a)).join(", ");
            this.printOutput.push(printed);
            return this.makeResult(
                "print",
                printed,
                printed,
                printed,
                "print",
                resolvedArgs,
            );
        }

        const fn = this.functions[name];
        if (fn === undefined) {
            return this.makeResult(
                "error",
                `Unknown function: ${name}()`,
                "",
                "",
                name,
                resolvedArgs,
            );
        }

        const fnResult = fn(...resolvedArgs);
        this.addTraceEntry("call", name, resolvedArgs, fnResult.value);
        this.addTraceEntry("return", name, resolvedArgs, fnResult.value);

        return this.makeResult(
            "call",
            fnResult.value, // output = the actual computed value
            fnResult.dialogue, // dialogue = what the phone bubble shows
            "",
            name,
            resolvedArgs,
        );
    }

    evaluateExpression(expr: string): string | number | boolean {
        const trimmed = expr.trim();

        if (
            (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"))
        ) {
            return trimmed.slice(1, -1);
        }

        if (trimmed === "True") return true;
        if (trimmed === "False") return false;

        const num = Number(trimmed);
        if (!isNaN(num) && trimmed !== "") return num;

        if (this.parseFunctionCall(trimmed) !== null) {
            const result = this.executeExpression(trimmed);
            return result.output; // use value, not dialogue
        }

        if (trimmed in this.variables) {
            const val = this.variables[trimmed];
            if (val !== undefined) return val;
        }

        if (trimmed.includes("+")) {
            return this.evaluateConcatenation(trimmed);
        }

        throw new Error(`Cannot resolve: ${trimmed}`);
    }

    private evaluateConcatenation(expr: string): string {
        const parts = this.splitOnPlus(expr);
        return parts
            .map((p) => String(this.evaluateExpression(p.trim())))
            .join("");
    }

    private parseFunctionCall(
        expr: string,
    ): { name: string; args: string[] } | null {
        const parenOpen = expr.indexOf("(");
        if (parenOpen === -1) return null;

        const name = expr.slice(0, parenOpen).trim();
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return null;

        const inner = expr.slice(parenOpen + 1);
        const parenClose = this.findMatchingParen(inner);
        if (parenClose === -1) return null;

        const argsString = inner.slice(0, parenClose).trim();
        const args = argsString.length === 0 ? [] : this.splitArgs(argsString);

        return { name, args };
    }

    private splitArgs(argsString: string): string[] {
        const args: string[] = [];
        let depth = 0;
        let inString = false;
        let stringChar = "";
        let current = "";

        for (const ch of argsString) {
            if (inString) {
                current += ch;
                if (ch === stringChar) inString = false;
            } else if (ch === '"' || ch === "'") {
                inString = true;
                stringChar = ch;
                current += ch;
            } else if (ch === "(") {
                depth++;
                current += ch;
            } else if (ch === ")") {
                depth--;
                current += ch;
            } else if (ch === "," && depth === 0) {
                args.push(current.trim());
                current = "";
            } else {
                current += ch;
            }
        }

        if (current.trim()) args.push(current.trim());
        return args;
    }

    private findMatchingParen(str: string): number {
        let depth = 1;
        let inString = false;
        let stringChar = "";

        for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if (inString) {
                if (ch === stringChar) inString = false;
            } else if (ch === '"' || ch === "'") {
                inString = true;
                stringChar = ch;
            } else if (ch === "(") {
                depth++;
            } else if (ch === ")") {
                depth--;
                if (depth === 0) return i;
            }
        }
        return -1;
    }

    private splitOnPlus(expr: string): string[] {
        const parts: string[] = [];
        let depth = 0;
        let inString = false;
        let stringChar = "";
        let current = "";

        for (const ch of expr) {
            if (inString) {
                current += ch;
                if (ch === stringChar) inString = false;
            } else if (ch === '"' || ch === "'") {
                inString = true;
                stringChar = ch;
                current += ch;
            } else if (ch === "(") {
                depth++;
                current += ch;
            } else if (ch === ")") {
                depth--;
                current += ch;
            } else if (ch === "+" && depth === 0) {
                parts.push(current);
                current = "";
            } else {
                current += ch;
            }
        }

        if (current) parts.push(current);
        return parts;
    }

    private isAssignment(line: string): boolean {
        const eqIndex = line.indexOf("=");
        if (eqIndex === -1) return false;
        if (line[eqIndex - 1] === "!" || line[eqIndex + 1] === "=")
            return false;
        const lhs = line.slice(0, eqIndex).trim();
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(lhs);
    }

    // ── Function span scanner ─────────────────────────────────────────────────

    private scanForFunctions(
        str: string,
        offset: number,
        depth: number,
        spans: FunctionSpan[],
    ) {
        let i = 0;
        while (i < str.length) {
            const nameMatch = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(str.slice(i));
            if (nameMatch === null) {
                i++;
                continue;
            }

            const name = nameMatch[0];
            const nameStart = offset + i;
            const nameEnd = nameStart + name.length;
            const afterName = str.slice(i + name.length).trimStart();

            if (!afterName.startsWith("(")) {
                i += name.length;
                continue;
            }

            const parenPos = str.indexOf("(", i + name.length);
            const inner = str.slice(parenPos + 1);
            const closePos = this.findMatchingParen(inner);

            if (closePos === -1) {
                i += name.length;
                continue;
            }

            const fullExpression = str.slice(i, parenPos + 1 + closePos + 1);
            spans.push({ name, nameStart, nameEnd, fullExpression, depth });

            const argsStr = inner.slice(0, closePos);
            this.scanForFunctions(
                argsStr,
                parenPos + 1 + offset,
                depth + 1,
                spans,
            );

            i =
                str.indexOf(fullExpression, i - fullExpression.length) +
                fullExpression.length;
        }
    }

    // ── Trace logging ─────────────────────────────────────────────────────────

    private addTraceEntry(
        event: "call" | "return",
        functionName: string,
        args: (string | number | boolean)[],
        returnValue: string,
    ) {
        this.traceLog.push({
            step: this.traceCounter++,
            event,
            functionName,
            args,
            returnValue,
        });
    }

    // ── Result factory ────────────────────────────────────────────────────────

    private makeResult(
        type: LineResult["type"],
        output: string,
        dialogue: string,
        printedValue: string,
        functionName: string,
        args: (string | number | boolean)[],
    ): LineResult {
        return { type, output, dialogue, printedValue, functionName, args };
    }
}
