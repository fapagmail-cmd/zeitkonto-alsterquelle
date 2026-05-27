# Use lightweight Node.js image
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (none currently, but runs quickly if added)
RUN npm install --production

# Copy the rest of the application files
COPY . .

# Expose the port the server runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
