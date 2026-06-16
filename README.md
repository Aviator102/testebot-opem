# Bot teste - UUID da foto do perfil OpenSim

Ele loga na grid e fica esperando IM. Você manda a UUID de um avatar e ele tenta retornar a UUID da foto do perfil.

## Instalar

```bash
npm install
```

## Rodar no Windows CMD

```cmd
set BOT_FIRST_NAME=Celeste
set BOT_LAST_NAME=Santos
set BOT_PASSWORD=SUA_SENHA_AQUI
set LOGIN_URI=http://www.alifevirtual.com:8002/
node bot-profile-photo.js
```

## Rodar no PowerShell

```powershell
$env:BOT_FIRST_NAME="Celeste"
$env:BOT_LAST_NAME="Santos"
$env:BOT_PASSWORD="SUA_SENHA_AQUI"
$env:LOGIN_URI="http://www.alifevirtual.com:8002/"
node bot-profile-photo.js
```

## Como testar

1. Deixe o bot online.
2. Envie IM para ele com a UUID do avatar:

```text
ebfa3892-5c02-4468-82c8-2788bf904729
```

3. Se a biblioteca expuser perfil, ele retorna a UUID da foto.
4. Se não retornar, envie `!methods` por IM e veja o log do servidor. Esse log mostra os métodos disponíveis para adaptar a chamada correta.

