FROM alpine:3.10.3
WORKDIR /app
COPY hello.sh /app
RUN chmod +x hello.sh
RUN apk update
RUN apk add curl
CMD ["./hello.sh"]