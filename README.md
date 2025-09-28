# Circuit Switching Simulator

This project is an interactive, web-based simulation of a circuit-switched telecommunications network. It visually demonstrates how network resources (links) are allocated and released to establish and terminate calls.

## Features

- **Network Visualization**: The network topology is rendered on an HTML5 canvas, showing switches and the links connecting them.
- **Circuit-Switched Behavior**: The simulation accurately models the three phases of circuit switching:
    1.  **Call Setup**: A path is found from a source to a destination switch using a Breadth-First Search (BFS) algorithm. If all links in the path are available, they are reserved.
    2.  **Data Transfer**: The reserved path (circuit) is visually highlighted, typically in green, to indicate that it is active.
    3.  **Call Release**: When a call is terminated, the links in the path are freed and made available for other calls.
- **Real-time Updates**: The state of the network is updated in real-time for all connected clients using WebSockets (Socket.IO).
- **Interactive Controls**: Users can select source and destination switches to initiate calls and release active calls.
- **Call Blocking**: If no path with free links can be found between the source and destination, the call is blocked, and a status message is displayed.

## Technology Stack

- **Backend**: Node.js with Express and Socket.IO
- **Frontend**: HTML5, CSS, JavaScript (with Socket.IO client)

## How It Works

1.  **Network Model**: The network is represented as a graph, with switches as nodes and communication links as edges. Each edge has a state: `free` or `occupied`.
2.  **Call Initiation**: When a user requests to establish a call, the server searches for a path. If a free path is found, the states of its edges are set to `occupied`.
3.  **State Broadcasting**: The server broadcasts the updated network state (including all edge states and active calls) to all clients.
4.  **UI Rendering**: The frontend JavaScript receives the network state and dynamically redraws the canvas to reflect any changes, such as new active circuits or released links.
