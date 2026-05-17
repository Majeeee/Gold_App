package se.gold.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.boot.autoconfigure.amqp.RabbitTemplateCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE   = "gold.trades";
    public static final String QUEUE      = "gold.trade.events";
    public static final String ROUTING_KEY = "trade.#";

    @Bean
    public TopicExchange tradeExchange() {
        return ExchangeBuilder.topicExchange(EXCHANGE).durable(true).build();
    }

    @Bean
    public Queue tradeQueue() {
        return QueueBuilder.durable(QUEUE).build();
    }

    @Bean
    public Binding tradeBinding(Queue tradeQueue, TopicExchange tradeExchange) {
        return BindingBuilder.bind(tradeQueue).to(tradeExchange).with(ROUTING_KEY);
    }

    @Bean
    public RabbitTemplateCustomizer rabbitTemplateCustomizer() {
        return t -> t.setMessageConverter(new Jackson2JsonMessageConverter());
    }
}
