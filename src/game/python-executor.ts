/**
 * python-executor.ts
 *
 * A lightweight Python-like execution engine for Detective Code.
 * Handles the subset of Python the game's puzzles require:
 *
 *   - Variable initialization from the transcript
 *   - String, number, and boolean literals as arguments
 *   - Variable lookups as arguments
 *   - Function calls and nested function calls
 *   - Variable assignment from a function call
 *   - The print() function
 *   - Python-style comments (ignored)
 *   - String concatenation with +
 *   - Finding which function the cursor is over on a line (for telephone)
 */

export type LevelFunction = (...args: (string | number | boolean)[]) => string;

export interface LineResult {
    type: "print" | "call" | "assign" | "comment" | "empty" | "error";
    output: string;
    printedValue: string;
    functionName: string;
    args: (string | number | boolean)[];
}

/**
 * Describes a function call found on a line, including its character span.
 * Used by the telephone to know which function the cursor is over.
 */
export interface FunctionSpan {
    name: string; // the function name (e.g. "outer")
    nameStart: number; // column index where the name starts
    nameEnd: number; // column index where the name ends (exclusive)
    fullExpression: string; // the complete call e.g. "outer(inner())"
    depth: number; // nesting depth (0 = top level, 1 = inside another call)
}

export interface TraceEntry {
    step: number;
    event: "call" | "return";
    functionName: string;
    args: (string | number | boolean)[];
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
            return this.makeResult("comment", "", "", "", []);
        }
        try {
            if (this.isAssignment(trimmed)) {
                return this.executeAssignment(trimmed);
            }
            return this.executeExpression(trimmed);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return this.makeResult("error", message, "", "", []);
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

    /**
     * Runs all lines strictly ABOVE lineIndex (not including it),
     * to set up variable assignments before a telephone call.
     */
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

    /**
     * Resets only variables set by the player (not transcript variables).
     * Used before re-running lines above the cursor for a telephone call.
     */
    resetPlayerVariables() {
        // Re-load only keeps transcript variables by clearing and reloading
        // This is handled externally by BaseLevel calling loadTranscript again
        this.variables = {};
    }

    getTraceLog(): TraceEntry[] {
        return [...this.traceLog];
    }

    // ── Telephone support ─────────────────────────────────────────────────────

    /**
     * Scans a line and returns all function call spans found on it,
     * ordered by their start position. Each span includes the function
     * name's character range so the cursor column can be matched against it.
     *
     * For "outer(inner())", returns two spans:
     *   { name: "outer", nameStart: 0, nameEnd: 5, depth: 0, fullExpression: "outer(inner())" }
     *   { name: "inner", nameStart: 6, nameEnd: 11, depth: 1, fullExpression: "inner()" }
     */
    findAllFunctionSpans(line: string): FunctionSpan[] {
        const spans: FunctionSpan[] = [];
        this.scanForFunctions(line, 0, 0, spans);
        return spans;
    }

    /**
     * Returns the function span the cursor column is currently over,
     * or null if the cursor is not over any function name.
     *
     * Rules:
     *   - Cursor must be within the function NAME characters (not parens or args)
     *   - For nested calls, the innermost matching function wins
     */
    findFunctionAtColumn(line: string, col: number): FunctionSpan | null {
        const spans = this.findAllFunctionSpans(line);

        // Find all spans whose NAME range contains the cursor column
        const matching = spans.filter(
            (s) => col >= s.nameStart && col < s.nameEnd,
        );

        if (matching.length === 0) return null;

        // If multiple match (shouldn't happen for name ranges), prefer deepest
        return matching.reduce((best, s) => (s.depth > best.depth ? s : best));
    }

    /**
     * Executes a specific function call expression for the telephone,
     * resolving all arguments (including nested calls) and returning the result.
     * Does NOT affect print output.
     */
    callForTelephone(expression: string): LineResult {
        const trimmed = expression.trim();
        try {
            return this.executeExpression(trimmed);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return this.makeResult("error", message, "", "", []);
        }
    }

    // ── Execution internals ───────────────────────────────────────────────────

    private executeAssignment(line: string): LineResult {
        const eqIndex = line.indexOf("=");
        if (eqIndex === -1) return this.makeResult("empty", "", "", "", []);

        const varName = line.slice(0, eqIndex).trim();
        const rhs = line.slice(eqIndex + 1).trim();

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
            return this.makeResult(
                "error",
                `Invalid variable name: ${varName}`,
                "",
                "",
                [],
            );
        }

        const value = this.evaluateExpression(rhs);
        this.variables[varName] = value;

        return this.makeResult("assign", String(value), "", varName, []);
    }

    private executeExpression(expression: string): LineResult {
        const callMatch = this.parseFunctionCall(expression);

        if (callMatch === null) {
            return this.makeResult(
                "error",
                `Cannot parse: ${expression}`,
                "",
                "",
                [],
            );
        }

        const { name, args: rawArgs } = callMatch;
        const resolvedArgs = rawArgs.map((arg) => this.evaluateExpression(arg));

        if (name === "print") {
            const printed = resolvedArgs.map((a) => String(a)).join(", ");
            this.printOutput.push(printed);
            return this.makeResult(
                "print",
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
                name,
                resolvedArgs,
            );
        }

        const result = fn(...resolvedArgs);
        this.addTraceEntry("call", name, resolvedArgs);

        return this.makeResult("call", result, "", name, resolvedArgs);
    }

    evaluateExpression(expr: string): string | number | boolean {
        const trimmed = expr.trim();

        // String literal
        if (
            (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"))
        ) {
            return trimmed.slice(1, -1);
        }

        // Boolean literals
        if (trimmed === "True") return true;
        if (trimmed === "False") return false;

        // Number literal
        const num = Number(trimmed);
        if (!isNaN(num) && trimmed !== "") return num;

        // Nested function call
        if (this.parseFunctionCall(trimmed) !== null) {
            const result = this.executeExpression(trimmed);
            return result.output;
        }

        // Variable lookup
        if (trimmed in this.variables) {
            const val = this.variables[trimmed];
            if (val !== undefined) return val;
        }

        // String concatenation
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

    /**
     * Recursively scans a string for function calls, recording each one's
     * name span and nesting depth. Handles nested calls by recursing into
     * the argument list of each found call.
     *
     * @param str     the string to scan
     * @param offset  how many characters into the original line this string starts
     * @param depth   current nesting depth
     * @param spans   accumulator array for found spans
     */
    private scanForFunctions(
        str: string,
        offset: number,
        depth: number,
        spans: FunctionSpan[],
    ) {
        let i = 0;
        while (i < str.length) {
            // Try to match a function name starting at position i
            const nameMatch = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(str.slice(i));
            if (nameMatch === null) {
                i++;
                continue;
            }

            const name = nameMatch[0];
            const nameStart = offset + i;
            const nameEnd = nameStart + name.length;
            const afterName = str.slice(i + name.length).trimStart();

            // Only treat it as a function call if followed by (
            if (!afterName.startsWith("(")) {
                i += name.length;
                continue;
            }

            // Find where the ( actually is in the original string
            const parenPos = str.indexOf("(", i + name.length);
            const inner = str.slice(parenPos + 1);
            const closePos = this.findMatchingParen(inner);

            if (closePos === -1) {
                i += name.length;
                continue;
            }

            // Full expression from name start to closing paren
            const fullExpression = str.slice(i, parenPos + 1 + closePos + 1);

            spans.push({
                name,
                nameStart,
                nameEnd,
                fullExpression,
                depth,
            });

            // Recurse into the arguments to find any nested function calls
            const argsStr = inner.slice(0, closePos);
            this.scanForFunctions(
                argsStr,
                parenPos + 1 + offset,
                depth + 1,
                spans,
            );

            // Advance past the entire call
            i = parenPos + 1 + closePos + 1 - (offset - offset);
            // Simpler: jump past the full expression
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
    ) {
        this.traceLog.push({
            step: this.traceCounter++,
            event,
            functionName,
            args,
        });
    }

    // ── Result factory ────────────────────────────────────────────────────────

    private makeResult(
        type: LineResult["type"],
        output: string,
        printedValue: string,
        functionName: string,
        args: (string | number | boolean)[],
    ): LineResult {
        return { type, output, printedValue, functionName, args };
    }
}
