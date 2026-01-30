# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json (root)
COPY package*.json ./

# Install root dependencies
RUN npm install --production=false

# Copy the rest of the application code
COPY . .

# Explicitly install server dependencies to ensure they exist
RUN cd server && npm install

# Build the frontend
RUN npm run build

# Expose the port the app runs on
EXPOSE 3001

# Define the command to run the app
CMD ["node", "server/index.js"]
