FROM apache

WORKDIR /var/www/html

RUN apt update -y
apt install apache2 -y
echo “<html>
<head>
  <title> Ubuntu rocks! </title>
</head>
<body>
  <h1> I'm running this website on an Ubuntu Server server! </h1>
</body>
</html>” > index.html

EXPOSE 8000
