FROM ubuntu:18.04
WORKDIR /app
COPY hello.sh /app
RUN chmod +x hello.sh
RUN apt-get update
RUN apt-get install curl -y
CMD ["./hello.sh"]