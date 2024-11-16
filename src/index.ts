/**
 * 将对象类型值转换为JSON字符串。
 *
 * @param value - 要转换的值，可以是任意类型。
 * @returns 如果输入值是对象类型，则返回其JSON字符串表示形式；否则，返回值本身。
 */
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
 * 输出信息框
 *
 * 该函数用于输出一个带有标题和内容的信息框如果只提供一个参数，它将作为内容显示，并使用默认标题 'Info'
 * 如果提供了多个参数，第一个参数将作为标题，其余参数作为内容显示
 *
 * @param contentOrTitle {any} - 内容或标题，具体取决于后续内容参数的数量
 * @param content 可变参数，包含错误的详细信息
 */
export const info = (contentOrTitle: any, ...content: any[]): void => {
    // 根据内容参数的数量，决定标题是使用默认值 'Info' 还是使用提供的第一个参数
    const title = content.length == 0 ? 'Info' : contentOrTitle;
    // 根据内容参数的数量，决定文本是使用提供的第一个参数还是使用其余参数
    const text = content.length == 0  ? [contentOrTitle] : content;
    // 使用确定的标题和文本，以及指定的颜色，调用 prettyPrint 函数来输出信息框
    prettyPrint(title, text, '#A6A6A6');
};

/**
 * 输出错误信息的函数
 *
 * 该函数用于以格式化的方式输出错误信息它接受一个参数或多个参数，并将它们分类为标题和文本，
 * 然后使用特定的颜色进行打印这个函数的存在是为了在控制台中以一种一致且易于识别的方式展示错误信息，
 * 以便开发者快速注意到错误
 *
 * @param contentOrTitle 错误的标题或内容，根据传入的参数数量决定其作用
 * @param content 可变参数，包含错误的详细信息
 */
export const error = (contentOrTitle: any, ...content: any[]): void => {
    // 根据内容参数的数量，决定标题是使用默认值 'Info' 还是使用提供的第一个参数
    const title = content.length == 0 ? 'Error' : contentOrTitle;
    const text = content.length == 0  ? [contentOrTitle] : content;
    // 使用确定的标题和文本，以及指定的颜色，调用 prettyPrint 函数来输出信息框
    prettyPrint(title, text, '#EC7270');
};

/**
 * 显示警告信息。
 *
 * 该函数用于显示警告信息，可以接受一个或多个消息参数。如果没有提供其他消息参数，则默认标题为 'Warning'。
 * 函数会调用 `prettyPrint` 函数来格式化并显示消息。
 *
 * @param contentOrTitle 第一个消息参数，如果没有其他消息参数，则作为标题。
 * @param content 可变参数，包含错误的详细信息
 */
export const warning = (contentOrTitle: any, ...content: any[]): void => {
    // 根据 content 数组的长度确定标题和文本
    const title = content.length == 0 ? 'Warning' : contentOrTitle;
    const text = content.length == 0  ? [contentOrTitle] : content;

    // 调用 prettyPrint 函数来格式化并显示标题、文本和警告颜色
    prettyPrint(title, text, '#F1AC6A');
};

/**
 * 显示成功信息
 *
 * 此函数接受一个标题和一个内容参数，用于在成功操作后向用户提供反馈信息
 * 如果只提供一个字符串，该字符串将同时作为标题和内容；如果提供一个对象作为内容，标题和内容将分别设置
 *
 * @param contentOrTitle 标题字符串，如果内容为空，则同时作为内容字符串
 * @param content 可变参数，包含错误的详细信息
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
