FROM node:14

# Install build tools
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    python3-setuptools \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev


WORKDIR /app

COPY package*.json ./

RUN npm install
ENV NODE_ENV=production

COPY . .

EXPOSE 5502

CMD ["npm", "start"]