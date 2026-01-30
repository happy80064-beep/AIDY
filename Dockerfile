# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (including devDependencies for build)
# Using npm because package-lock.json is present
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the frontend and install server dependencies
# The 'build' script in package.json runs: "tsc && vite build && cd server && npm install"
RUN npm run build

# Expose the port the app runs on
EXPOSE 3001

# Define the command to run the app
CMD ["npm", "start"]
