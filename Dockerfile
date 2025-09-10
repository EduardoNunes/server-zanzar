FROM node:18

WORKDIR /app

# Copia os arquivos de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante dos arquivos do projeto, incluindo o diretório prisma
COPY . .

# Gera o Prisma Client
RUN npx prisma generate

# Expõe a porta usada pelo backend
EXPOSE 3001

# Comando para aplicar migrações e iniciar o servidor
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:nodemon"]
