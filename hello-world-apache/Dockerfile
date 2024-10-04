FROM apache

WORKDIR /var/www/html

RUN <<EOR 
	apt update -y
	apt install apache2 -y
	echo “<html>
	<head>
  		<title> Ubuntu rocks! </title>
	</head>
	<body>
  		<h1> I'm running this website on an Ubuntu Server server! </h1>
	</body>
	</html>” > index.html
EOR

CMD sudo service apache2 start

EXPOSE 8000
