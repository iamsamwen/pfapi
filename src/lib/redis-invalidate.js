'use strict';

module.exports = {
    on_invalidate,
    off_invalidate,
};

async function on_invalidate(redis, {prefix, on_event, bcast = true, noloop = true}) {

    const client = await redis.get_client();
    const subscribe_client = await redis.get_client(true);

    const id = await subscribe_client.client('id');
    const argv = ['tracking', 'on', 'redirect', id, 'prefix', prefix]; 
    if (bcast) argv.push('bcast');
    if (noloop) argv.push('noloop');
    const command_result = await redis.send_command({client, cmd: 'client', argv});
    if (command_result !== 'OK') {
        console.error('on_invalidate, failed to send_command');
        await redis.close(subscribe_client);
        return {};
    }

    const invalidate_channel = '__redis__:invalidate';
    const subscribe_result = await subscribe_client.subscribe(invalidate_channel);
    if (subscribe_result !== 1) {
        console.error('on_invalidate, failed to subscribe');
        await redis.close(subscribe_client);
        return {};
    }
    
    subscribe_client.on('message', async (channel, data) => {
        //console.log('on_invalidate', {channel, data});
        if (channel !== invalidate_channel) return;
        if (!data.startsWith(prefix)) return;
        const redis_keys = data.split(',');
        await on_event(redis_keys);
    });
    
    return {subscribe_client, id};
}

async function off_invalidate(redis, id) {
    const argv = ['tracking', 'off', 'redirect', id];
    const client = await redis.get_client();
    const result = await redis.send_command({client, cmd: 'client', argv});
    if (result !== 'OK') {
        console.error('turnoff_invalidate, failed to send_command');
        return false;
    }
    return true;
}
