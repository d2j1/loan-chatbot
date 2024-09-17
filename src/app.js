const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());
app.use(cors());

// In-memory store for user conversations
const userConversations = {};

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: "localhost",
  user: "student", // replace with your MySQL username
  password: "2151", // replace with your MySQL password
  database: "loan_application",
});

// Promisify for Node.js async/await.
const promisePool = pool.promise();

async function query(sql, values) {
  try {
    const [results] = await promisePool.query(sql, values);
    return results;
  } catch (err) {
    console.error("Database query error:", err);
    throw err;
  }
}

// EMI calculation function
function calculateEMI(loanAmount, loanDuration, interestRate) {
  const monthlyRate = interestRate / 12 / 100;
  const months = loanDuration * 12;
  const EMI =
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1);
  return EMI.toFixed(2); // Return EMI rounded to two decimal places
}

app.post("/message", async (req, res) => {
  try {
    const userMessage = req.body.message.toLowerCase();
    let botResponse = "";
    let userState = userConversations[req.body.sessionId] || { step: 0 };

    // Handle exit to main menu
    if (userMessage === "0") {
      botResponse =
        "Welcome back! Please choose an option:\n1. Apply for a loan\n2. Ask a query\n3. EMI Calculator\n0. Exit";
      userState = { step: 0 }; // Reset to starting state
      userConversations[req.body.sessionId] = userState;
      return res.json({ response: botResponse });
    }

    if (userState.step === 0) {
      botResponse =
        "Welcome! Choose an option:\n1. Apply for a loan\n2. Ask a query\n3. EMI Calculator\n0. Exit";
      userState.step = 1;
    } else if (userState.step === 1) {
      if (userMessage.includes("1")) {
        botResponse =
          "Let's start your loan application. What's your full name? (Enter '0' to exit)";
        userState = { step: 2, applyingForLoan: true };
      } else if (userMessage.includes("2")) {
        botResponse = "Please enter your query. (Enter '0' to exit)";
        userState = { step: 20, askingQuery: true };
      } else if (userMessage.includes("3")) {
        botResponse =
          "Enter loan amount, loan duration (in years), and interest rate separated by commas (e.g., 100000,5,10). (Enter '0' to exit)";
        userState = { step: 30, calculatingEMI: true };
      } else if (userMessage.includes("0")) {
        botResponse = "Exiting. Thank you for using the service. Goodbye!";
        userState = { step: 0 }; // Reset to starting state
      } else {
        botResponse =
          "Please choose a valid option:\n1. Apply for a loan\n2. Ask a query\n3. EMI Calculator\n0. Exit";
        userState.step = 1; // Stay in the main menu step
      }
    } else if (userState.applyingForLoan) {
      // Loan application steps
      switch (userState.step) {
        case 2:
          botResponse = "What's your gender? (Enter '0' to exit)";
          userState.name = userMessage;
          userState.step = 3;
          break;
        case 3:
          botResponse = "Date of Birth (YYYY/MM/DD)? (Enter '0' to exit)";
          userState.gender = userMessage;
          userState.step = 4;
          break;
        case 4:
          botResponse = "PAN Card Number? (Enter '0' to exit)";
          userState.dob = userMessage;
          userState.step = 5;
          break;
        case 5:
          botResponse = "Email address? (Enter '0' to exit)";
          userState.pan = userMessage;
          userState.step = 6;
          break;
        case 6:
          botResponse = "Company/Employer name? (Enter '0' to exit)";
          userState.email = userMessage;
          userState.step = 7;
          break;
        case 7:
          botResponse = "Monthly Net Income? (Enter '0' to exit)";
          userState.company = userMessage;
          userState.step = 8;
          break;
        case 8:
          botResponse = "Monthly commitment (EMI amount)? (Enter '0' to exit)";
          userState.income = userMessage;
          userState.step = 9;
          break;
        case 9:
          botResponse = "House No/Name? (Enter '0' to exit)";
          userState.commitment = userMessage;
          userState.step = 10;
          break;
        case 10:
          botResponse = "Street Name or No? (Enter '0' to exit)";
          userState.houseNo = userMessage;
          userState.step = 11;
          break;
        case 11:
          botResponse = "Town Name? (Enter '0' to exit)";
          userState.streetName = userMessage;
          userState.step = 12;
          break;
        case 12:
          botResponse = "Pincode? (Enter '0' to exit)";
          userState.townName = userMessage;
          userState.step = 13;
          break;
        case 13:
          botResponse = "City? (Enter '0' to exit)";
          userState.pincode = userMessage;
          userState.step = 14;
          break;
        case 14:
          botResponse = "State? (Enter '0' to exit)";
          userState.city = userMessage;
          userState.step = 15;
          break;
        case 15:
          botResponse =
            "Is this address Temporary or Permanent? (Enter '0' to exit)";
          userState.state = userMessage;
          userState.step = 16;
          break;
        case 16:
          botResponse =
            "How much loan amount do you require? (Enter '0' to exit)";
          userState.addressType = userMessage; // Temporary or Permanent
          userState.step = 17;
          break;
        case 17:
          botResponse =
            "What is the duration of the loan (in months)? (Enter '0' to exit)";
          userState.loanAmount = userMessage;
          userState.step = 18;
          break;
        case 18:
          botResponse = "What is the reason for the loan? (Enter '0' to exit)";
          userState.loanDuration = userMessage;
          userState.step = 19;
          break;
        case 19:
          botResponse =
            "Thank you for your details. We will process your loan application. (Enter '0' to exit)";

          // Store details in DB
          try {
            await query(
              "INSERT INTO loan_applications (name, gender, dob, pan, email, company, income, commitment, houseNo, streetName, townName, pincode, city, state, addressType, loanAmount, loanDuration, loanReason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                userState.name,
                userState.gender,
                userState.dob,
                userState.pan,
                userState.email,
                userState.company,
                userState.income,
                userState.commitment,
                userState.houseNo,
                userState.streetName,
                userState.townName,
                userState.pincode,
                userState.city,
                userState.state,
                userState.addressType,
                userState.loanAmount,
                userState.loanDuration,
                userState.loanReason,
              ]
            );
            botResponse =
              "Loan application complete! We will contact you shortly. (Enter '0' to exit)";
          } catch (error) {
            console.error("Error storing loan application data:", error);
            botResponse =
              "There was an error processing your loan application. Please try again later. (Enter '0' to exit)";
          }

          // Reset user state after completing loan application
          userState = { step: 0 };
          break;
      }
    } else if (userState.askingQuery) {
      // Call external API and respond
      const apiResponse = await externalAPIQuery(userMessage); // Make your API call here
      botResponse = `Response: ${apiResponse} (Enter '0' to exit)`;
      userState = { step: 0 }; // Reset after query
    } else if (userState.calculatingEMI) {
      // EMI calculation
      const [loanAmount, loanDuration, interestRate] = userMessage
        .split(",")
        .map(Number);
      if (loanAmount && loanDuration && interestRate) {
        const emi = calculateEMI(loanAmount, loanDuration, interestRate);
        botResponse = `Your EMI is ${emi}. (Enter '0' to exit)`;
      } else {
        botResponse =
          "Invalid input. Please enter loan amount, duration, and interest rate separated by commas (e.g., 100000,5,10). (Enter '0' to exit)";
      }
      userState = { step: 0 }; // Reset after EMI calculation
    } else if (userState.step === 20) {
      botResponse =
        "Thank you for your query. We will get back to you shortly. (Enter '0' to exit)";
      userState = { step: 0 }; // Reset after query
    } else {
      botResponse =
        "Please choose a valid option:\n1. Apply for a loan\n2. Ask a query\n3. EMI Calculator\n0. Exit";
      userState.step = 1;
    }

    // Save user state
    userConversations[req.body.sessionId] = userState;
    res.json({ response: botResponse });
  } catch (error) {
    console.error("Error handling message:", error);
    res
      .status(500)
      .json({ response: "An error occurred. Please try again later." });
  }
});

// Function to query the external API
async function externalAPIQuery(query) {
  const externalApiUrl = "https://api.example.com/query"; // Replace with actual external API URL

  try {
    const response = await axios.post(externalApiUrl, { query });
    return response.data; // Assuming the response contains the needed data
  } catch (error) {
    console.error("Error querying external API:", error);
    return "Unable to fetch data from the external API.";
  }
}

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
