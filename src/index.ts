/**
 * 检查给定值是否为空
 *
 * 该函数用于判断传入的值是否为空，支持字符串和对象类型的检查
 * 空值的定义包括：null、undefined和空字符串('')
 *
 * @param value 待检查的值，可以是字符串或对象
 * @returns 返回布尔值，如果值为空，则返回true；否则返回false
 */
const isEmpty = (value: any): boolean => {
    return value === null || value === undefined || value === '';
}

const stringify = (value: any): boolean => {
    return typeof value === 'object' ? JSON.stringify(value) : value;
}

/**
 * 格式化打印控制台日志
 * @param title 日志标题
 * @param text 日志内容数组
 * @param color 日志的显示颜色
 */
const prettyPrint = (title: string, text: any[], color: string): void => {
    // 初始化内容字符串，以包含标题
    let content = `%c ${title} `;
    // 遍历文本数组，格式化每个元素并添加到内容字符串中
    for (const idx in text) {
        const formattedText = stringify(text[idx]);
        content = content + `\n%c ${formattedText} `
    }
    // 初始化日志数组，用于存储格式化后的日志内容和样式
    let logs: any = []
    // 将内容和标题的样式添加到日志数组中
    logs.push(content)
    logs.push(`background:${color};border:1px solid ${color}; padding: 1px; border-radius: 2px; color: #fff;`)
    // 遍历文本数组，为每个元素添加相应的样式到日志数组中
    for (const idx in text) {
        logs.push(`border:1px solid ${color}; padding: 1px; border-radius: 2px; color: ${color};`)
    }
    // 输出格式化后的日志到控制台
    console.log(...logs);
};


/**
 * 显示信息对话框
 *
 * 该函数用于弹出一个信息对话框，对话框包含一个标题和一段文本内容
 * 当传入的content为空时，contentOrTitle将作为标题；否则，contentOrTitle为内容，标题为'Info'
 *
 * @param contentOrTitle 字符串类型，当content为空时，这是标题；否则是文本内容
 * @param content 字符串或对象类型，对话框的文本内容，如果为空，则contentOrTitle作为标题，否则contentOrTitle作为内容，而content为文本
 * @returns 无返回值
 */
export const info = (contentOrTitle: any, ...content: any[]): void => {
    // 根据content是否为空，分配title和text
    const title = content.length == 0 ? 'Info' : contentOrTitle;
    const text = content.length == 0  ? [contentOrTitle] : content;
    // 调用prettyPrint函数，格式化打印对话框
    prettyPrint(title, text, '#A6A6A6');
};

/**
 * 显示错误信息
 *
 * 此函数用于统一显示错误信息的格式它可以接受一个标题和一个内容，如果只提供一个字符串，将同时用作标题和内容
 * 通过判断内容是否为空来决定标题和内容的分配，如果内容为空，标题为'Error'，内容为提供的字符串；否则，标题和内容分别对应提供的两个参数
 * 最后，使用prettyPrint函数以特定的颜色格式化显示标题和内容
 *
 * @param contentOrTitle 错误信息的标题或内容如果提供了两个参数，此参数为标题
 * @param content 错误信息的内容如果只有一个参数被提供，此参数被忽略
 */
export const error = (contentOrTitle: any, ...content: any[]): void => {
    // 根据content是否为空，分配标题和内容
    const title = content.length == 0 ? 'Error' : contentOrTitle;
    const text = content.length == 0  ? [contentOrTitle] : content;
    // 使用特定颜色格式化显示错误信息
    prettyPrint(title, text, '#EC7270');
};

/**
 * 显示警告信息
 *
 * 此函数用于在控制台中格式化并输出警告信息它接受一个标题和一个内容参数，
 * 并根据这些参数在控制台中打印出格式化的警告信息标题默认为'Warning'，
 * 如果提供了content参数，则使用content作为标题内容如果只提供了contentOrTitle参数，
 * 则该参数既作为标题也作为内容
 *
 * @param contentOrTitle - 警告信息的标题或内容
 * @param content - 警告信息的内容，可以是字符串或对象，默认为空字符串
 */
export const warning = (contentOrTitle: any, ...content: any[]): void => {
    // 根据content参数的有无，分配标题和内容
    const title = content.length == 0 ? 'Warning' : contentOrTitle;
    const text = content.length == 0  ? [contentOrTitle] : content;
    // 调用prettyPrint函数以特定格式打印警告信息
    prettyPrint(title, text, '#F1AC6A');
};

/**
 * 显示成功信息
 *
 * 此函数接受一个标题和一个内容参数，用于在成功操作后向用户提供反馈信息
 * 如果只提供一个字符串，该字符串将同时作为标题和内容；如果提供一个对象作为内容，标题和内容将分别设置
 *
 * @param contentOrTitle 标题字符串，如果内容为空，则同时作为内容字符串
 * @param content 内容字符串或对象，默认为空字符串如果为空字符串，则内容为标题字符串
 */
export const success = (contentOrTitle: any, ...content: any[]): void => {
    // 根据内容是否为空，动态设置标题和内容
    const title = content.length == 0 ? 'Success' : contentOrTitle;
    const text = content.length == 0  ? [contentOrTitle] : content;
    // 使用指定的颜色格式化和打印信息
    prettyPrint(title, text, '#95DA69');
};

/**
 * 在控制台打印彩虹色文本
 *
 * 该函数接受一个字符串或对象作为参数，并在控制台打印出彩虹色的文本
 * 如果传入的是对象，则会先将其转换为JSON字符串
 *
 * @param text 要打印的文本或对象
 */
export const rainbow = (text: string | object): void => {
    // 根据参数类型，将对象转换为JSON字符串或直接使用文本
    let formattedText = typeof text === 'object' ? JSON.stringify(text) : text;
    // 使用console.log打印彩虹色文本，通过CSS样式实现彩虹效果
    console.log(`%c${formattedText}`, "background: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet); color: white; padding: 2px;");
};

/**
 * 创建一个控制台输出组，用于有组织地输出信息
 * @param title 组的标题
 * @param content 组内要输出的内容数组，可以是字符串或对象数组
 * @param expand 组默认是否展开，可选，默认为true
 */
export const group = (title: string, content: string[] | object[], expand: boolean = true): void => {
    // 创建一个组
    if (expand)
        console.group(`%c${title}:`, "background-color: #7B79E8; color: #ffffff; font-weight: bold; padding: 4px;");
    else
        console.groupCollapsed(`%c${title}:`, "background-color: #7B79E8; color: #ffffff; font-weight: bold; padding: 4px;");
    // 分组输出
    content.forEach((item) => {
        // 格式化输出内容，如果是对象则转为JSON字符串
        let formattedText = typeof item === 'object' ? JSON.stringify(item) : item;
        console.log(`%c${formattedText}`, "color: #7B79E8; padding: 2px;");
    });
    // 结束
    console.groupEnd();
}

/**
 * 将数组数据以表格形式输出到控制台
 *
 * @param data 一个任意类型的数组，其元素将被显示在表格中
 */
export const table = (data: any[]): void => {
    console.table(data);
};

// 定义一个函数，用于加载并绘制一张图片
export const picture = (url: string, scale: number = 1): void => {
    // 创建一个新的图片对象
    const img = new Image();
    // 设置图片的跨域属性，使其可以加载跨域图片
    img.crossOrigin = 'anonymous';
    // 图片加载成功后的回调函数
    img.onload = () => {
        // 创建一个canvas元素用于绘制图片
        const c = document.createElement('canvas');
        // 获取canvas的2D绘图上下文
        const ctx = c.getContext('2d');
        // 如果成功获取到上下文则继续绘制
        if (ctx) {
            // 设置canvas的宽度和高度与图片相同
            c.width = img.width;
            c.height = img.height;
            // 设置canvas的背景颜色为白色
            ctx.fillStyle = 'white';
            // 在canvas上绘制一个与图片大小相同的红色矩形
            ctx.fillRect(0, 0, c.width, c.height);
            // 将图片绘制到canvas上
            ctx.drawImage(img, 0, 0);
            // 将canvas的内容转换为PNG格式的DataURL
            const dataUri = c.toDataURL('image/png');

            // 在控制台输出图片，使其按指定比例缩放后显示
            console.log(
                `%c sup?`,
                `font-size: 1px;
                    padding: ${Math.floor((img.height * scale) / 2)}px ${Math.floor((img.width * scale) / 2)}px;
                    background-image: url(${dataUri});
                    background-repeat: no-repeat;
                    background-size: ${img.width * scale}px ${img.height * scale}px;
                    color: transparent;
                    `
            );
        }
    };
    // 设置图片的源地址，触发加载
    img.src = url;
}
