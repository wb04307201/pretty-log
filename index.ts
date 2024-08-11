const isEmpty = (value: string): boolean => {
    return value === null || value === undefined || value === '';
}

const prettyPrint = (title: string, text: string, color: string): void => {
    console.log(
        `%c ${title} %c ${text} %c`,
        `background:${color};border:1px solid ${color}; padding: 1px; border-radius: 2px 0 0 2px; color: #fff;`,
        `border:1px solid ${color}; padding: 1px; border-radius: 0 2px 2px 0; color: ${color};`,
        'background:transparent'
    );
};


export const info = (textOrTitle: string, content: string = ''): void => {
    const title = isEmpty(content) ? 'Info' : textOrTitle;
    const text = isEmpty(content) ? textOrTitle : content;
    prettyPrint(title, text, '#A6A6A6');
};


export const error = (textOrTitle: string, content: string = ''): void => {
    const title = isEmpty(content) ? 'Error' : textOrTitle;
    const text = isEmpty(content) ? textOrTitle : content;
    prettyPrint(title, text, '#EC7270');
};

export const warning = (textOrTitle: string, content: string = ''): void => {
    const title = isEmpty(content) ? 'Warning' : textOrTitle;
    const text = isEmpty(content) ? textOrTitle : content;
    prettyPrint(title, text, '#F1AC6A');
};

export const success = (textOrTitle: string, content: string = ''): void => {
    const title = isEmpty(content) ? 'Success ' : textOrTitle;
    const text = isEmpty(content) ? textOrTitle : content;
    prettyPrint(title, text, '#95DA69');
};

export const rainbow = (text: string): void => {
    console.log(`%c${text}`, "background: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet); color: white; padding: 2px;");
};

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

export const table = (data: any[]): void => {
    console.table(data);
};


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