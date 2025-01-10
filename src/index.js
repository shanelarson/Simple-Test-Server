import express from 'express'; // Import express
const app = express();             // Create an express app
const port = 3000;                 // Set the port

// Define the default route
app.get('/', (req, res) => {
    res.send('Hello, World!'); // Send "Hello, World!" as the response
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
