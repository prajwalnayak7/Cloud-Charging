import express from "express";
import { createClient } from "redis";
import { json } from "body-parser";

const DEFAULT_BALANCE = 100;

interface ChargeResult {
    isAuthorized: boolean;
    remainingBalance: number;
    charges: number;
}

const url = `redis://${process.env.REDIS_HOST ?? "localhost"}:${process.env.REDIS_PORT ?? "6379"}`;
const client = createClient({ url });
client.connect();  // Establish a persistent connection during app startup

async function reset(account: string, balance: number): Promise<void> {
    await client.set(`${account}/balance`, balance.toString());
}

async function charge(account: string, charges: number): Promise<ChargeResult> {
    const balance = parseInt((await client.get(`${account}/balance`)) ?? "0");

    // Special case: Zero balance, zero charge should be authorized
    if (balance === 0 && charges === 0) {
        return { isAuthorized: true, remainingBalance: 0, charges: 0 };
    }

    // Denial conditions for positive charges:
    if ((balance < charges && charges > 0) || 
        (balance < 0 && charges > 0)) {
        return { isAuthorized: false, remainingBalance: balance, charges: 0 };
    }

    const newBalance = balance - charges;  // This handles both positive and negative charges
    
    // Ensure resulting balance isn't negative:
    if (newBalance < 0) {
        return { isAuthorized: false, remainingBalance: balance, charges: 0 };
    }

    console.log("Charging account", account, "for", charges, "charges. New balance:", newBalance);
    await client.set(`${account}/balance`, newBalance.toString());
    return { isAuthorized: true, remainingBalance: newBalance, charges };
}


export function buildApp(): express.Application {
    const app = express();
    app.use(json());

    app.post("/reset", async (req, res) => {
        try {
            const account = req.body.account ?? "account";
            const balance = req.body.balance ?? DEFAULT_BALANCE;
            await reset(account, balance);
            console.log(`Successfully reset account ${account}`);
            res.sendStatus(204);
        } catch (e) {
            console.error("Error while resetting account", e);
            res.status(500).json({ error: String(e) });
        }
    });

    app.post("/charge", async (req, res) => {
        try {
            const account = req.body.account ?? "account";
            const result = await charge(account, req.body.charges ?? 10);
            console.log(`Successfully charged account ${account}`);
            res.status(200).json(result);
        } catch (e) {
            console.error("Error while charging account", e);
            res.status(500).json({ error: String(e) });
        }
    });
    
    return app;
}
