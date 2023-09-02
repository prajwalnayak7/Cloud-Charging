import { performance } from "perf_hooks";
import supertest from "supertest";
import { buildApp } from "./app";

const app = supertest(buildApp());

// Table-driven test setup
const chargeTests = [
    { account: "test1", initialBalance: 100, chargeAmount: 50, expectedBalance: 50, isAuthorized: true }, // Normal charge
    { account: "test2", initialBalance: 100, chargeAmount: 150, expectedBalance: 100, isAuthorized: false }, // Attempt to overcharge
    { account: "test3", initialBalance: 0, chargeAmount: 10, expectedBalance: 0, isAuthorized: false }, // No balance to start with
    { account: "test4", initialBalance: 100, chargeAmount: 0, expectedBalance: 100, isAuthorized: true }, // Charge amount is zero
    { account: "test5", initialBalance: 100, chargeAmount: -10, expectedBalance: 110, isAuthorized: true }, // Negative charge (i.e., a refund or credit)
    { account: "test6", initialBalance: 0, chargeAmount: 0, expectedBalance: 0, isAuthorized: true }, // Zero balance, zero charge
    { account: "test7", initialBalance: -10, chargeAmount: 10, expectedBalance: -10, isAuthorized: false }, // Negative balance, positive charge
    { account: "test8", initialBalance: -10, chargeAmount: -10, expectedBalance: 0, isAuthorized: true }, // Negative balance, negative charge (i.e., settling a debt)
    { account: "test9", initialBalance: 100, chargeAmount: 100, expectedBalance: 0, isAuthorized: true }, // Charge exactly the available balance
    { account: "test10", initialBalance: -100, chargeAmount: 150, expectedBalance: -100, isAuthorized: false }, // Negative balance, attempt to overcharge
];

async function testChargeMechanism() {
    for (const test of chargeTests) {
        // Reset balance to initial state
        await app.post("/reset").send({ account: test.account, balance: test.initialBalance }).expect(204);

        // Attempt to charge the account
        const response = await app.post("/charge").send({ account: test.account, charges: test.chargeAmount });
        const chargeResult = response.body;

        // Check the results
        if (chargeResult.isAuthorized !== test.isAuthorized || chargeResult.remainingBalance !== test.expectedBalance) {
            console.error(`Test for account ${test.account} failed. Expected isAuthorized: ${test.isAuthorized}, got: ${chargeResult.isAuthorized}. Expected remainingBalance: ${test.expectedBalance}, got: ${chargeResult.remainingBalance}.`);
        } else {
            console.log(`Test for account ${test.account} passed.`);
        }
    }
}

async function basicLatencyTest() {
    await app.post("/reset").expect(204);

    const numCalls = 100;
    const start = performance.now();

    for (let i = 0; i < numCalls; i++) {
        await app.post("/charge").expect(200);
    }

    const totalTime = performance.now() - start;
    const averageLatency = totalTime / numCalls;

    console.log(`Average Latency over ${numCalls} calls: ${averageLatency.toFixed(2)} ms`);
}

async function runTests() {
    await testChargeMechanism(); // Run the table-driven tests
    await basicLatencyTest();    // Run the latency test
}

runTests().catch(console.error);
