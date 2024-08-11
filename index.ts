/**
 * 检查给定的字符串是否为空
 *
 * 该函数通过判断字符串是否为null、undefined或空字符串来判断其是否为空
 * 在许多情况下，需要判断一个字符串是否具有实际内容，此函数提供了一个简洁的方法
 *
 * @param value 待检查的字符串
 * @returns 如果字符串为null、undefined或空字符串，则返回true，否则返回false
 */
const isEmpty = (value: string): boolean => {
    return value === null || value === undefined || value === '';
}

/**
 * 将标题和文本以漂亮的格式打印在控制台上
 *
 * @param title 标题，用于标识打印内容的名称或标题
 * @param text 要打印的文本内容
 * @param color 文本和背景的颜色，用于设置打印文本的视觉样式
 */
const prettyPrint = (title: string, text: string, color: string): void => {
    // 使用console.log打印标题和文本，通过css样式参数使输出内容具有更好的视觉效果
    console.log(
        `%c ${title} %c ${text} %c`,
        `background:${color};border:1px solid ${color}; padding: 1px; border-radius: 2px 0 0 2px; color: #fff;`, // 标题的样式，包括背景色、边框、内边距和圆角等
        `border:1px solid ${color}; padding: 1px; border-radius: 0 2px 2px 0; color: ${color};`, // 文本的样式，包括边框、内边距和圆角等
        'background:transparent' // 分隔符的样式，这里使用透明背景
    );
};

/**
 * 显示信息框
 *
 * 该函数用于在用户界面中显示一个信息框，信息框包含一个标题和一段文本
 * 当只有一个字符串参数提供时，该参数将被用作信息框的文本内容，此时标题默认为'Info'
 * 当提供两个字符串参数时，第一个参数将被用作标题，第二个参数将被用作文本内容
 *
 * @param textOrTitle 字符串参数，用于信息框的文本内容或标题
 * @param content 可选的字符串参数，用于信息框的文本内容当未提供该参数时，默认文本内容为空字符串
 * @returns 无返回值
 */
export const info = (textOrTitle: string, content: string = ''): void => {
    // 根据content是否为空，确定title和text的值
    const title = isEmpty(content) ? 'Info' : textOrTitle;
    const text = isEmpty(content) ? textOrTitle : content;
    // 调用prettyPrint函数，使用灰色('#A6A6A6')打印信息框的标题和文本
    prettyPrint(title, text, '#A6A6A6');
};

/**
 * 显示错误信息
 *
 * 此函数接受一个字符串或标题和内容，如果内容为空，则将文本作为标题和内容；否则，将文本作为内容
 * 标题默认为'Error'，可以通过传递空内容来使用文本作为标题
 * 内容为空时，标题为'Error'，内容为传入的文本；内容不为空时，标题为传入的文本，内容为传入的内容
 *
 * @param textOrTitle 文本或标题
 * @param content 内容，默认为空字符串
 */
export const error = (textOrTitle: string, content: string = ''): void => {
    // 根据内容是否为空，设置标题和内容
    const title = isEmpty(content) ? 'Error' : textOrTitle;
    const text = isEmpty(content) ? textOrTitle : content;
    // 使用指定样式打印错误信息
    prettyPrint(title, text, '#EC7270');
};

/**
 * 显示警告信息
 *
 * 此函数用于在控制台中格式化并输出警告信息它接受一个标题和一个内容参数，
 * 如果只提供一个字符串参数，那么该参数将作为标题，否则第一个参数将作为标题，第二个参数作为内容
 * 当内容为空字符串时，标题将使用默认值'Warning'，否则将使用提供的内容
 *
 * @param textOrTitle 警告信息的标题或内容，当内容为空时，此参数将作为标题
 * @param content 警告信息的内容，默认为空字符串，如果提供，将覆盖默认内容
 */
export const warning = (textOrTitle: string, content: string = ''): void => {
    // 根据内容是否为空，设置警告信息的标题和内容
    const title = isEmpty(content) ? 'Warning' : textOrTitle;
    const text = isEmpty(content) ? textOrTitle : content;
    // 使用指定的颜色格式化输出警告信息
    prettyPrint(title, text, '#F1AC6A');
};

/**
 * 显示成功信息
 *
 * 该函数接受一个标题和内容参数，如果内容为空，则将标题作为成功信息的标题，
 * 否则将标题作为成功信息的内容标题，内容作为成功信息的内容
 *
 * @param textOrTitle 成功信息的标题或内容
 * @param content 成功信息的具体内容，默认为空字符串
 */
export const success = (textOrTitle: string, content: string = ''): void => {
    // 根据内容是否为空，决定是使用textOrTitle作为标题还是内容
    const title = isEmpty(content) ? 'Success ' : textOrTitle;
    const text = isEmpty(content) ? textOrTitle : content;

    // 使用指定的颜色格式化打印标题和内容
    prettyPrint(title, text, '#95DA69');
};

/**
 * 在控制台打印彩色文本
 *
 * 该函数使用给定的文本在控制台输出一道彩虹色的文本效果它通过CSS样式实现，
 * 将文本背景设置为从左到右渐变的彩虹色，同时确保文本颜色为白色，以便清晰显示
 *
 * @param text 要在控制台打印的文本
 */
export const rainbow = (text: string): void => {
    console.log(`%c${text}`, "background: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet); color: white; padding: 2px;");
};

/**
 * 在控制台中以分组的形式输出信息
 * @param title 分组的标题
 * @param content 分组中要输出的内容数组
 */
export const group = (title: string, content: string[]): void => {
    // 创建一个组
    console.group(`%c${title}:`, "background-color: #7B79E8; color: #ffffff; font-weight: bold; padding: 4px;");
    // 分组输出
    content.forEach((item) => {
        console.log(`%c${item}`, "color: #7B79E8; padding: 2px;");
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
